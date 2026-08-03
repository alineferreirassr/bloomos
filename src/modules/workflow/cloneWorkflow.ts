"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import type { Workflow } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

export type CloneWorkflowResult = { success: true; data: Workflow } | { success: false; error: string };

/** Step 11's own "Clone" — a brand-new draft Workflow copying the source's current graph, independent of it from that point on. */
export async function cloneWorkflow(workflowId: string): Promise<CloneWorkflowResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const source = await getWorkflowManager().getWorkflowById(workflowId);
  if (!source || source.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getWorkflowManager().cloneWorkflow(workflowId, session.user.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
