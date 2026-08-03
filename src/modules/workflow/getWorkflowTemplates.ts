"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowTemplates } from "@/modules/workflow/registerWorkflowTemplates";
import { listWorkflowTemplates } from "@/core/workflow/templateRegistry";
import type { WorkflowTemplate } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "Workflow Templates aren't available right now.";

registerWorkflowTemplates();

export type GetWorkflowTemplatesResult = { success: true; data: WorkflowTemplate[] } | { success: false; error: string };

/**
 * Step 7's own Template gallery data — unlike Node summaries
 * (`getWorkflowEditorData.ts`'s own `WorkflowNodeSummary`), a
 * `WorkflowTemplate` is already plain data (no functions anywhere in its
 * own `graph`), so it's returned as-is; still routed through a Server
 * Action rather than read client-side, matching every other registry read
 * in this module for consistency.
 */
export async function getWorkflowTemplates(): Promise<GetWorkflowTemplatesResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: listWorkflowTemplates() };
}
