"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getAutomationManager } from "@/core/automation/manager";
import { getAutomation } from "@/core/automation/registry";
import { canGrantApproval } from "@/core/automation/approval";
import { executeAutomation } from "@/core/automation/resolver";
import { getLogger } from "@/core/observability/logger";
import type { AutomationExecution, AutomationTriggerEvent } from "@/types/automation";

const GENERIC_ACCESS_ERROR = "This Automation approval isn't available. It may not exist, or you may not have access to it.";

export type ApproveAutomationExecutionResult = { success: true; data: AutomationExecution } | { success: false; error: string };

/**
 * A human's explicit "yes" to a pending Automation (Step 4's own Approval
 * Engine, surfaced through the Dashboard) — never automatic. Re-runs the
 * whole Automation through `executeAutomation()` with `approved: true` —
 * the same single execution path every other trigger goes through, per
 * Step 10's "the Automation Engine remains the only execution path" — which
 * produces a brand-new, fully-executed history record. The original
 * `"pending_approval"` record is left in place (append-only, matching the
 * Audit Log's own precedent), except its own approval bookkeeping fields
 * are updated via the repository's dedicated `approveExecution` so the
 * original request itself also shows as resolved, not just superseded.
 */
export async function approveAutomationExecution(executionId: string): Promise<ApproveAutomationExecutionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const manager = getAutomationManager();
  const pending = await manager.getExecutionById(executionId);
  if (!pending || pending.workspaceId !== session.workspace.id || pending.approvalStatus !== "pending") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const automation = getAutomation(pending.automationId);
  if (!automation) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  if (!canGrantApproval({ policy: automation.approvalPolicy, approverRole: session.membership.role })) {
    return { success: false, error: "Your role isn't permitted to approve this Automation." };
  }

  const trigger: AutomationTriggerEvent = {
    type: pending.trigger,
    workspaceId: pending.workspaceId,
    occurredAt: pending.startedAt,
    actorMemberId: null,
    facts: pending.triggerFacts,
  };

  const execution = await executeAutomation({
    automation,
    trigger,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? null,
    role: session.membership.role,
    permissions: session.permissions,
    approved: true,
    approverRole: session.membership.role,
    approverId: session.user.id,
  });

  const bookkeeping = await manager.approveExecution(executionId, session.user.id);
  if (!bookkeeping.success) {
    getLogger().error("Failed to mark original pending Automation execution as approved", { executionId, error: bookkeeping.error });
  }

  return { success: true, data: execution };
}
