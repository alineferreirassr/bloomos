"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { archiveWorkflowAndDisableAutomations, unarchiveWorkflowAndEnableAutomations } from "@/core/workflow/publisher";
import { getWorkflowManager } from "@/core/workflow/manager";
import type { Workflow } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

export type ArchiveWorkflowResult = { success: true; data: Workflow } | { success: false; error: string };

async function isOwnedWorkflowRequest(workflowId: string): Promise<boolean> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return false;
  if (!session.permissions.includes("workspace.manage")) return false;
  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  return Boolean(workflow && workflow.workspaceId === session.workspace.id);
}

export async function archiveWorkflow(workflowId: string): Promise<ArchiveWorkflowResult> {
  if (!(await isOwnedWorkflowRequest(workflowId))) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await archiveWorkflowAndDisableAutomations(workflowId);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function unarchiveWorkflow(workflowId: string): Promise<ArchiveWorkflowResult> {
  if (!(await isOwnedWorkflowRequest(workflowId))) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await unarchiveWorkflowAndEnableAutomations(workflowId);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
