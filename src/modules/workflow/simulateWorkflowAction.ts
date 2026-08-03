"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { simulateWorkflow } from "@/core/workflow/simulator";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getLogger } from "@/core/observability/logger";
import { recordWorkflowSimulationRun } from "@/lib/data/core/workflow/simulationStore";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import type { WorkflowGraph, WorkflowSimulationResult } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "This Workflow isn't available. It may not exist, or you may not have access to it.";

registerWorkflowNodes();

export type SimulateWorkflowActionResult = { success: true; data: WorkflowSimulationResult } | { success: false; error: string };

/**
 * Step 6's own Server Action — the Editor's "Run Simulation" button calls
 * this the same way it calls `validateWorkflowDraft` for the Validation
 * tab: `graph` is the author's own live, possibly-unsaved in-progress
 * edit, not necessarily what's persisted. Permission/workspace-scoping
 * mirrors `validateWorkflowDraft.ts` exactly — Step 13's own "Workflow
 * scoped, Workspace scoped."
 */
export async function simulateWorkflowAction(workflowId: string, graph: WorkflowGraph): Promise<SimulateWorkflowActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const workflow = await getWorkflowManager().getWorkflowById(workflowId);
  if (!workflow || workflow.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await simulateWorkflow({ graph, workspaceId: session.workspace.id });
  getLogger().info("Workflow simulation requested", { workflowId, pathCount: result.paths.length, issueCount: result.issues.length });
  recordWorkflowSimulationRun(session.workspace.id, workflowId, result.paths.length, result.issues.length);

  publishWebhookEvent({
    type: "workflow.simulated",
    workspaceId: session.workspace.id,
    resource: { type: "workflow", id: workflowId },
    payload: { workflow_id: workflowId, path_count: result.paths.length, issue_count: result.issues.length, occurred_at: new Date().toISOString() },
  });

  return { success: true, data: result };
}
