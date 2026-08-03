import { evaluateConditions } from "@/core/automation/conditions";
import { resolveApprovalRequirement, canGrantApproval } from "@/core/automation/approval";
import { runAutomationAction } from "@/core/automation/actionRunner";
import { listAutomationsForTrigger } from "@/core/automation/registry";
import { getAutomationManager } from "@/core/automation/manager";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { getLogger } from "@/core/observability/logger";
import { clockNow } from "@/core/time/clock";
import type { Permission } from "@/core/enums/permission";
import type {
  AutomationActionExecutionResult,
  AutomationDefinition,
  AutomationExecution,
  AutomationExecutionStatus,
  AutomationTriggerEvent,
} from "@/types/automation";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ExecuteAutomationContext {
  workspaceName: string | null;
  userId: string | null;
  userName: string | null;
  role: WorkspaceMemberRole | null;
  permissions: Permission[];
  /** Only meaningful once approval has actually been requested and granted by a human — see `docs/automation-engine.md`'s own "Approval flow." */
  approved?: boolean;
  approverRole?: WorkspaceMemberRole | null;
  approverId?: string | null;
}

export interface ExecuteAutomationParams extends ExecuteAutomationContext {
  automation: AutomationDefinition;
  trigger: AutomationTriggerEvent;
}

async function persist(
  automation: AutomationDefinition,
  trigger: AutomationTriggerEvent,
  startedAt: string,
  startTime: number,
  fields: {
    conditionsPassed: boolean;
    approvalStatus: AutomationExecution["approvalStatus"];
    approvedBy: string | null;
    approvedAt: string | null;
    actionResults: AutomationActionExecutionResult[];
    status: AutomationExecutionStatus;
    startedBy: string | null;
  },
): Promise<AutomationExecution> {
  const completedAt = clockNow().toISOString();
  const durationMs = Date.now() - startTime;

  const result = await getAutomationManager().recordExecution(trigger.workspaceId, {
    automationId: automation.id,
    automationName: automation.name,
    automationVersion: automation.version,
    trigger: trigger.type,
    triggerFacts: trigger.facts,
    conditionsPassed: fields.conditionsPassed,
    approvalStatus: fields.approvalStatus,
    approvedBy: fields.approvedBy,
    approvedAt: fields.approvedAt,
    actionResults: fields.actionResults,
    status: fields.status,
    durationMs,
    startedAt,
    completedAt,
    startedBy: fields.startedBy,
  });

  if (!result.success) {
    // The Knowledge Store rejecting a write (should not happen for a
    // well-formed input) still must not throw — return an in-memory-only
    // record so the caller always gets a structured result, per Step 7's
    // own "structured result" responsibility.
    return {
      id: "unpersisted",
      workspaceId: trigger.workspaceId,
      automationId: automation.id,
      automationName: automation.name,
      automationVersion: automation.version,
      trigger: trigger.type,
      triggerFacts: trigger.facts,
      ...fields,
      durationMs,
      startedAt,
      completedAt,
    };
  }
  return result.data;
}

/**
 * The Step 7 Execution Engine — the single path every Automation runs
 * through: permission validation → condition evaluation → approval
 * validation → action execution → audit logging (`persist`, always, no
 * matter which gate stopped it) → structured result. Never called by a UI
 * component directly with a raw action id — a UI only ever supplies a
 * `AutomationTriggerEvent` (via `dispatchAutomationTrigger`) or an already-
 * registered `AutomationDefinition` (this function), never an ad-hoc list
 * of actions to run, which is what makes "the Automation Engine remains
 * the only execution path" (Step 10) true by construction.
 */
export async function executeAutomation(params: ExecuteAutomationParams): Promise<AutomationExecution> {
  const startedAt = clockNow().toISOString();
  const startTime = Date.now();
  const { automation, trigger } = params;

  getLogger().info("Automation dispatch requested", { workspaceId: trigger.workspaceId, automationId: automation.id, trigger: trigger.type });

  // 1. Permission validation
  if (automation.requiredPermissions.some((permission) => !params.permissions.includes(permission))) {
    getLogger().warn("Automation execution denied — missing permission", { automationId: automation.id });
    return persist(automation, trigger, startedAt, startTime, {
      conditionsPassed: false,
      approvalStatus: "not_required",
      approvedBy: null,
      approvedAt: null,
      actionResults: [],
      status: "failure",
      startedBy: params.userId ?? null,
    });
  }
  if (automation.minimumRole && (!params.role || !roleMeetsMinimum(params.role, automation.minimumRole))) {
    getLogger().warn("Automation execution denied — role below minimum", { automationId: automation.id });
    return persist(automation, trigger, startedAt, startTime, {
      conditionsPassed: false,
      approvalStatus: "not_required",
      approvedBy: null,
      approvedAt: null,
      actionResults: [],
      status: "failure",
      startedBy: params.userId ?? null,
    });
  }
  if (automation.featureFlag) {
    const enabled = await evaluateFeatureFlag(trigger.workspaceId, automation.featureFlag);
    if (!enabled) {
      getLogger().warn("Automation execution denied — feature flag disabled", { automationId: automation.id });
      return persist(automation, trigger, startedAt, startTime, {
        conditionsPassed: false,
        approvalStatus: "not_required",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "failure",
        startedBy: params.userId ?? null,
      });
    }
  }

  // 2. Condition evaluation — deterministic, never an AI prompt (see `conditions.ts`).
  const conditionsPassed = await evaluateConditions(automation.conditions, { trigger, role: params.role });
  getLogger().info("Automation conditions evaluated", { automationId: automation.id, conditionsPassed });
  if (!conditionsPassed) {
    return persist(automation, trigger, startedAt, startTime, {
      conditionsPassed: false,
      approvalStatus: "not_required",
      approvedBy: null,
      approvedAt: null,
      actionResults: [],
      status: "skipped_conditions_not_met",
      startedBy: params.userId ?? null,
    });
  }

  // 3. Approval validation
  const approvalRequired = await resolveApprovalRequirement({
    workspaceId: trigger.workspaceId,
    automationId: automation.id,
    policy: automation.approvalPolicy,
  });
  getLogger().info("Automation approval resolved", { automationId: automation.id, approvalRequired });

  if (approvalRequired) {
    if (params.approved !== true) {
      return persist(automation, trigger, startedAt, startTime, {
        conditionsPassed: true,
        approvalStatus: "pending",
        approvedBy: null,
        approvedAt: null,
        actionResults: [],
        status: "pending_approval",
        startedBy: params.userId ?? null,
      });
    }
    if (!canGrantApproval({ policy: automation.approvalPolicy, approverRole: params.approverRole ?? null })) {
      getLogger().warn("Automation approval rejected — approver role insufficient", { automationId: automation.id });
      return persist(automation, trigger, startedAt, startTime, {
        conditionsPassed: true,
        approvalStatus: "rejected",
        approvedBy: params.approverId ?? null,
        approvedAt: clockNow().toISOString(),
        actionResults: [],
        status: "rejected",
        startedBy: params.userId ?? null,
      });
    }
  }

  // 4. Action execution — a fixed, linear sequence (Step 15's own
  // "multi-step workflows/branching/parallel actions" are reserved, not
  // implemented; see `AutomationWorkflowExtension`).
  const actionResults: AutomationActionExecutionResult[] = [];
  for (const actionId of automation.actionIds) {
    const result = await runAutomationAction(
      actionId,
      {
        workspaceId: trigger.workspaceId,
        workspaceName: params.workspaceName,
        userId: params.userId,
        userName: params.userName,
        role: params.role,
        permissions: params.permissions,
        facts: trigger.facts,
        automationId: automation.id,
      },
      automation.maxRetries,
    );
    actionResults.push(result);
  }

  const failures = actionResults.filter((result) => result.status === "failure").length;
  const status: AutomationExecutionStatus =
    actionResults.length === 0 || failures === 0 ? "success" : failures === actionResults.length ? "failure" : "partial_failure";

  const execution = await persist(automation, trigger, startedAt, startTime, {
    conditionsPassed: true,
    approvalStatus: approvalRequired ? "approved" : "not_required",
    approvedBy: approvalRequired ? (params.approverId ?? null) : null,
    approvedAt: approvalRequired ? clockNow().toISOString() : null,
    actionResults,
    status,
    startedBy: params.userId ?? null,
  });

  getLogger().info("Automation execution finished", { automationId: automation.id, status, actionCount: actionResults.length, failures });
  return execution;
}

/**
 * The fan-out entry point a real trigger event reaches the engine through
 * — looks up every **active** Automation registered for `trigger.type`
 * (`listAutomationsForTrigger`) and runs each independently. This is the
 * function a real domain mutation (e.g. `acceptProposalDraft.ts`) calls
 * after firing its own trigger; a Skill never calls this directly (Step
 * 10's own "Skills may NEVER execute automations directly").
 */
export async function dispatchAutomationTrigger(trigger: AutomationTriggerEvent, context: ExecuteAutomationContext): Promise<AutomationExecution[]> {
  const automations = listAutomationsForTrigger(trigger.type);
  const results: AutomationExecution[] = [];
  for (const automation of automations) {
    results.push(await executeAutomation({ automation, trigger, ...context }));
  }
  return results;
}
