"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getAutomationManager } from "@/core/automation/manager";
import { getAutomation } from "@/core/automation/registry";
import { canGrantApproval } from "@/core/automation/approval";
import type { AutomationExecution } from "@/types/automation";

const GENERIC_ACCESS_ERROR = "This Automation approval isn't available. It may not exist, or you may not have access to it.";

export type RejectAutomationExecutionResult = { success: true; data: AutomationExecution } | { success: false; error: string };

/**
 * A human's explicit "no" to a pending Automation — the counterpart to
 * `approveAutomationExecution`. Never runs any Action; simply marks the
 * pending execution's own record `rejected` (a terminal state, matching
 * `executeAutomation`'s own `"rejected"` branch for an insufficient-approver
 * failure), so nothing further happens for this specific execution.
 */
export async function rejectAutomationExecution(executionId: string): Promise<RejectAutomationExecutionResult> {
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
    return { success: false, error: "Your role isn't permitted to reject this Automation." };
  }

  const result = await manager.rejectExecution(executionId, session.user.id);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}
