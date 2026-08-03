"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import type { Workflow } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

export type RestoreWorkflowVersionResult = { success: true; data: Workflow } | { success: false; error: string };

/** Step 11's own "Restore" — copies a prior version's own graph/metadata/executionPolicy back onto the current draft. Never touches the version record itself, and never re-publishes — a restored draft still needs its own explicit Publish. */
export async function restoreWorkflowVersion(workflowId: string, version: number): Promise<RestoreWorkflowVersionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  if (!workflow || workflow.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getWorkflowManager().restoreWorkflowVersion(workflowId, version);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
