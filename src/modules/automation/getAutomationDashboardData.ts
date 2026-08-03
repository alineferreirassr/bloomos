"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerAutomationDefinitions } from "@/modules/automation/registerAutomationDefinitions";
import { getAutomationManager } from "@/core/automation/manager";
import { listAutomationsForWorkspace } from "@/core/automation/discovery";
import { listAutomationActions } from "@/core/automation/actionRegistry";
import { canGrantApproval } from "@/core/automation/approval";
import { AUTOMATION_TRIGGER_TYPES } from "@/types/automation";
import { getAutomation, listAutomationsForTrigger } from "@/core/automation/registry";
import type {
  AutomationCategory,
  AutomationDefinition,
  AutomationExecution,
  AutomationExecutionStatus,
  AutomationTriggerType,
} from "@/types/automation";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

const GENERIC_ACCESS_ERROR = "The Automation dashboard isn't available right now.";
const RECENT_EXECUTIONS_LIMIT = 25;
const FAILURE_SUMMARY_LIMIT = 5;

// Registered once per process — idempotent, mirrors every other Automation/AI entry point's own call-on-load.
registerAutomationDefinitions();

export interface AutomationExecutionStats {
  totalExecutions: number;
  byStatus: Record<AutomationExecutionStatus, number>;
  averageDurationMs: number;
  successRatePercent: number | null;
}

export interface AutomationTriggerSummary {
  type: AutomationTriggerType;
  /** Active Automations currently listening for this trigger — a trigger with 0 listeners is registered but has nothing wired to it yet. */
  listenerCount: number;
}

export interface AutomationFailureSummaryEntry {
  automationId: string;
  automationName: string;
  failureCount: number;
  lastFailureAt: string | null;
}

/**
 * `AutomationActionDefinition` minus its own `execute` function — an RSC
 * boundary can't serialize a function prop to a Client Component (Next.js
 * throws at render time), the same reason `SkillMetadata` exists alongside
 * `SkillDefinition` for Skills. This is the Dashboard's own read-only view
 * of an Action, never used to actually run one.
 */
export interface AutomationActionSummary {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  version: string;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
}

export interface AutomationDashboardData {
  recentExecutions: AutomationExecution[];
  pendingApprovals: AutomationExecution[];
  /** Which of `pendingApprovals` this member could actually act on — role-gated per that Automation's own approval policy (see `canGrantApproval`). */
  approvableExecutionIds: string[];
  registeredAutomations: AutomationDefinition[];
  registeredActions: AutomationActionSummary[];
  triggerSummary: AutomationTriggerSummary[];
  stats: AutomationExecutionStats;
  failureSummary: AutomationFailureSummaryEntry[];
}

export type GetAutomationDashboardDataResult = { success: true; data: AutomationDashboardData } | { success: false; error: string };

function computeStats(executions: AutomationExecution[]): AutomationExecutionStats {
  const byStatus: Record<AutomationExecutionStatus, number> = {
    success: 0,
    failure: 0,
    partial_failure: 0,
    pending_approval: 0,
    skipped_conditions_not_met: 0,
    rejected: 0,
  };
  let totalDurationMs = 0;
  for (const execution of executions) {
    byStatus[execution.status] += 1;
    totalDurationMs += execution.durationMs;
  }

  const decided = byStatus.success + byStatus.failure + byStatus.partial_failure;
  return {
    totalExecutions: executions.length,
    byStatus,
    averageDurationMs: executions.length === 0 ? 0 : Math.round(totalDurationMs / executions.length),
    successRatePercent: decided === 0 ? null : Math.round((byStatus.success / decided) * 100),
  };
}

function computeFailureSummary(executions: AutomationExecution[]): AutomationFailureSummaryEntry[] {
  const byAutomation = new Map<string, { automationName: string; failureCount: number; lastFailureAt: string | null }>();
  for (const execution of executions) {
    if (execution.status !== "failure" && execution.status !== "partial_failure") continue;
    const existing = byAutomation.get(execution.automationId) ?? { automationName: execution.automationName, failureCount: 0, lastFailureAt: null };
    existing.failureCount += 1;
    if (!existing.lastFailureAt || execution.startedAt > existing.lastFailureAt) existing.lastFailureAt = execution.startedAt;
    byAutomation.set(execution.automationId, existing);
  }
  return [...byAutomation.entries()]
    .map(([automationId, entry]) => ({ automationId, ...entry }))
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, FAILURE_SUMMARY_LIMIT);
}

/**
 * The Step 9 Automation Dashboard's own read model — every section
 * (Recent Executions, Pending Approvals, Automation Health, Execution
 * Statistics, Registered Triggers, Registered Actions, Failure Summary)
 * comes from one call here, mirroring `getBloomAIOverview.ts`'s own
 * "one aggregate, computed fresh, never a hand-maintained UI array"
 * design. Stats/failure summary are computed from `recentExecutions`
 * (the same window the Dashboard itself shows), not a separate unbounded
 * scan — good enough for this checkpoint's own mock-repository scale;
 * a real analytics rollup is a future concern, not this Step's job.
 * Registered Triggers/Actions are shown platform-wide (not
 * workspace-filtered) since this is an operational/developer-facing view
 * of what the Engine itself knows about, not a "what can I run" picker —
 * `registeredAutomations` is the one list that IS workspace-filtered
 * (`listAutomationsForWorkspace`), since an Automation gated behind a
 * permission/role/feature-flag this member doesn't have would be
 * misleading to show as "yours."
 */
export async function getAutomationDashboardData(): Promise<GetAutomationDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const manager = getAutomationManager();
  const [recentExecutions, pendingApprovals, registeredAutomations] = await Promise.all([
    manager.getRecentExecutions(session.workspace.id, RECENT_EXECUTIONS_LIMIT),
    manager.getPendingApprovals(session.workspace.id),
    listAutomationsForWorkspace({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role }),
  ]);

  const approvableExecutionIds = pendingApprovals
    .filter((execution) => {
      const automation = getAutomation(execution.automationId);
      if (!automation) return false;
      return canGrantApproval({ policy: automation.approvalPolicy, approverRole: session.membership.role });
    })
    .map((execution) => execution.id);

  const triggerSummary: AutomationTriggerSummary[] = AUTOMATION_TRIGGER_TYPES.map((type) => ({
    type,
    listenerCount: listAutomationsForTrigger(type).length,
  }));

  return {
    success: true,
    data: {
      recentExecutions,
      pendingApprovals,
      approvableExecutionIds,
      registeredAutomations,
      registeredActions: listAutomationActions().map(({ id, name, description, category, version, requiredPermissions, featureFlag, minimumRole }) => ({
        id,
        name,
        description,
        category,
        version,
        requiredPermissions,
        featureFlag,
        minimumRole,
      })),
      triggerSummary,
      stats: computeStats(recentExecutions),
      failureSummary: computeFailureSummary(recentExecutions),
    },
  };
}
