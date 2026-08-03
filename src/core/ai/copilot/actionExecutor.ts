import { getAutomationAction } from "@/core/automation/actionRegistry";
import { getLogger } from "@/core/observability/logger";
import type { AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export interface CopilotActionCallParams {
  workspaceId: string;
  workspaceName: string | null;
  userId: string;
  userName: string | null;
  role: string;
  permissions: string[];
  /** The same loose fact bag every `AutomationActionDefinition.execute` already reads its inputs from. */
  facts?: Record<string, string | number | boolean | null>;
}

/**
 * Checkpoint 20, Step 8 — the Action Executor. Deliberately thin: every
 * "one-click action" Bloom AI can run (Create Proposal, Create Reminder,
 * Reserve Inventory, ...) is already a real `AutomationActionDefinition` in
 * `core/automation/actionRegistry.ts` — including the auto-generated
 * fallback every runnable Skill gets via `makeRunSkillAction()` (see
 * `modules/automation/registerAutomationActions.ts`'s own doc comment).
 * This function is the one seam the Copilot Panel calls through; it never
 * re-implements what an Action already does, it only re-checks the same
 * permission gate `executeAutomation()` itself applies (Actions are shared
 * across two callers now — the Automation Engine and the Copilot — so
 * neither can assume the other already checked).
 */
export async function executeCopilotAction(actionId: string, params: CopilotActionCallParams): Promise<AutomationActionResultDetail> {
  const action = getAutomationAction(actionId);
  if (!action) {
    return { success: false, message: "This action isn't available yet." };
  }

  if (action.requiredPermissions.some((permission) => !params.permissions.includes(permission))) {
    return { success: false, message: "You don't have permission to run this action." };
  }

  const actionParams: AutomationActionParams = {
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    role: params.role as AutomationActionParams["role"],
    permissions: params.permissions as AutomationActionParams["permissions"],
    facts: params.facts ?? {},
    automationId: "copilot-manual",
  };

  const result = await action.execute(actionParams);
  getLogger().info("Copilot action executed", { actionId, workspaceId: params.workspaceId, success: result.success });
  return result;
}

/** Whether `actionId` currently resolves to a real, runnable Action — the Copilot Panel uses this to decide whether a suggestion's action button is clickable or informational-only. */
export function isCopilotActionAvailable(actionId: string): boolean {
  return getAutomationAction(actionId) !== undefined;
}
