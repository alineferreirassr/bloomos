"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkflowManager } from "@/core/workflow/manager";
import type { Workflow } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "The Workflow list isn't available right now.";

export type GetWorkflowsListResult = { success: true; data: Workflow[] } | { success: false; error: string };

/** Every Workflow in this member's own Workspace — the Step 7 Workflow List's own data source, newest-updated first (see `mockWorkflowRepository.listWorkflows`). */
export async function getWorkflowsList(): Promise<GetWorkflowsListResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workflows = await getWorkflowManager().listWorkflows(session.workspace.id);
  return { success: true, data: workflows };
}
