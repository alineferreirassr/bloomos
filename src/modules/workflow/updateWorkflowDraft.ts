"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import type { UpdateWorkflowDraftInput } from "@/lib/data/core/workflow/repository";
import type { Workflow } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

export type UpdateWorkflowDraftResult = { success: true; data: Workflow } | { success: false; error: string };

/** The Editor's own autosave path — called on every graph/metadata/execution-policy edit. Never touches a published `WorkflowVersion`; only the mutable draft. */
export async function updateWorkflowDraft(workflowId: string, input: UpdateWorkflowDraftInput): Promise<UpdateWorkflowDraftResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = await getWorkflowManager().getWorkflowById(workflowId);
  if (!existing || existing.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getWorkflowManager().updateWorkflowDraft(workflowId, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
