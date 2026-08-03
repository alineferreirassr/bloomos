import { getAutomationAction } from "@/core/automation/actionRegistry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { getLogger } from "@/core/observability/logger";
import { computeBackoffDelayMs } from "@/core/integrations/retryEngine";
import { delay } from "@/lib/data/utils";
import { DEFAULT_RETRY_POLICY } from "@/core/integrations/types";
import type { AutomationActionExecutionResult, AutomationActionParams } from "@/types/automation";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

/**
 * Runs exactly one registered Action — permission/role/feature-flag gates
 * first (the same enforcement order `executeSkill()` already established
 * for Skills), then Step 7's own "retry strategy": on a thrown exception or
 * a `{success: false}` result, retries up to `maxRetries` additional times.
 * Never called directly by a UI component — only `executeAutomation()`
 * calls this, per Step 7's own "No UI component may execute actions
 * directly."
 *
 * v2 Checkpoint 22, Step 10 — retries now wait with the same exponential
 * backoff (`computeBackoffDelayMs`, `core/integrations/retryEngine.ts`)
 * Webhooks' own Retry Engine already uses, closing the exact gap this
 * function's own prior doc comment flagged ("Step 15's own 'retry
 * policies' ... reserved for a future [checkpoint]"). `delay()` is a
 * no-op in the test environment (`lib/data/utils.ts`), so this file's own
 * existing retry-strategy tests run exactly as fast as before.
 */
export async function runAutomationAction(actionId: string, params: AutomationActionParams, maxRetries: number): Promise<AutomationActionExecutionResult> {
  const action = getAutomationAction(actionId);
  if (!action) {
    return { actionId, status: "failure", message: `No Action is registered for "${actionId}".`, attempts: 0 };
  }
  if (action.requiredPermissions.some((permission) => !params.permissions.includes(permission))) {
    return { actionId, status: "failure", message: "Missing required permission for this Action.", attempts: 0 };
  }
  if (action.minimumRole && (!params.role || !roleMeetsMinimum(params.role, action.minimumRole))) {
    return { actionId, status: "failure", message: "Role does not meet this Action's own minimum.", attempts: 0 };
  }
  if (action.featureFlag) {
    const enabled = await evaluateFeatureFlag(params.workspaceId, action.featureFlag);
    if (!enabled) return { actionId, status: "failure", message: "This Action isn't enabled for this Workspace yet.", attempts: 0 };
  }

  let attempts = 0;
  let lastMessage = "Action did not run.";
  const totalAttempts = Math.max(1, maxRetries + 1);

  while (attempts < totalAttempts) {
    attempts += 1;
    try {
      const result = await action.execute(params);
      if (result.success) {
        return { actionId, status: "success", message: result.message, attempts, resultRef: result.resultRef ?? null };
      }
      lastMessage = result.message;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Unknown error.";
    }
    if (attempts < totalAttempts) {
      const delayMs = computeBackoffDelayMs(attempts, DEFAULT_RETRY_POLICY);
      getLogger().warn("Automation action retrying", { actionId, attempt: attempts, automationId: params.automationId, delayMs });
      await delay(delayMs);
    }
  }

  return { actionId, status: "failure", message: lastMessage, attempts };
}
