"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { validateWorkflow } from "@/core/workflow/validation";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getLogger } from "@/core/observability/logger";
import type { WorkflowGraph, WorkflowValidationResult } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

registerWorkflowNodes();

export type ValidateWorkflowDraftResult = { success: true; data: WorkflowValidationResult } | { success: false; error: string };

/**
 * Validates a graph the Editor hasn't necessarily saved yet — `graph` is
 * passed directly rather than re-read from storage, so the Validation
 * Panel can reflect the author's own in-progress edits live. Exists as its
 * own Server Action (rather than the Editor calling `validateWorkflow`
 * client-side) specifically because `core/workflow/validation.ts`'s own
 * per-node checks read the Node Registry, and populating that registry
 * requires `registerWorkflowNodes()` — which transitively imports the real
 * Automation Actions and can never run in a Client Component (see
 * `NodeCatalogContext.tsx`'s own doc comment for the same constraint).
 */
export async function validateWorkflowDraft(workflowId: string, graph: WorkflowGraph): Promise<ValidateWorkflowDraftResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  if (!workflow || workflow.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = validateWorkflow(graph);
  // `debug`, not `info` — this fires on every debounced live-edit in the
  // Editor, so it stays out of the default log volume while still being a
  // real, traceable observability point (Step 16's own "Track... validation").
  getLogger().debug("Workflow draft validated", { workflowId, issueCount: result.issues.length });
  return { success: true, data: result };
}
