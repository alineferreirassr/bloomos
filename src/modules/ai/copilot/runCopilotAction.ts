"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeCopilotAction } from "@/core/ai/copilot/actionExecutor";
import { registerAutomationActions } from "@/modules/automation/registerAutomationActions";
import type { AutomationActionResultDetail } from "@/types/automation";

registerAutomationActions();

const GENERIC_ACCESS_ERROR = "This action isn't available right now.";

export type RunCopilotActionResult = { success: true; data: AutomationActionResultDetail } | { success: false; error: string };

/**
 * Checkpoint 20, Step 8 — the one entry point the Copilot Panel calls to
 * run a one-click action. Resolves the real, current session server-side
 * (never trusts a client-supplied workspaceId/userId) and hands off to
 * `executeCopilotAction`, which is the only place that actually touches
 * `core/automation/actionRegistry.ts`.
 */
export async function runCopilotAction(
  actionId: string,
  facts?: Record<string, string | number | boolean | null>,
): Promise<RunCopilotActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const result = await executeCopilotAction(actionId, {
    workspaceId: session.workspace.id,
    workspaceName: session.workspace.name,
    userId: session.user.id,
    userName: session.profile.full_name ?? null,
    role: session.membership.role,
    permissions: session.permissions,
    facts,
  });

  return { success: true, data: result };
}
