import { generateId, nowIso } from "@/lib/data/utils";
import { getGlobalMockStore } from "@/lib/data/core/globalMockStore";

export interface WorkflowSimulationRun {
  id: string;
  workspace_id: string;
  workflow_id: string;
  path_count: number;
  issue_count: number;
  occurred_at: string;
}

/**
 * Checkpoint 15 — a real, persisted record of every "Run Simulation" click
 * (`simulateWorkflowAction.ts`), so Workflow Analytics' own "Simulation
 * usage" metric (Step 7) is a genuine count rather than an unimplemented
 * placeholder. The Simulator itself (Checkpoint 13) never persisted a
 * run — it's a pure, side-effect-free preview — so this is purely
 * additive tracking, never a change to what Simulation actually computes.
 * Mock-only, unconditionally, the same "new checkpoint domain, mock-only
 * this phase" precedent every other Checkpoint 13/14 store already
 * established.
 *
 * Backed by `getGlobalMockStore` (not a plain `let`) since Checkpoint 16 —
 * writes happen from the internal Workflow Builder's Server Action, reads
 * also happen from `/api/v1/workflows/:id/simulations` (a Route Handler),
 * two independently-compiled module graphs in Next.js's dev server. See
 * that module's own doc comment.
 */
const store = getGlobalMockStore<WorkflowSimulationRun[]>("workflowSimulationStore.runs", () => []);

export function resetWorkflowSimulationStore(): void {
  store.set([]);
}

export function recordWorkflowSimulationRun(workspaceId: string, workflowId: string, pathCount: number, issueCount: number): void {
  store.set([...store.get(), { id: generateId("workflow-simulation-run"), workspace_id: workspaceId, workflow_id: workflowId, path_count: pathCount, issue_count: issueCount, occurred_at: nowIso() }]);
}

export function listWorkflowSimulationRuns(workspaceId: string): WorkflowSimulationRun[] {
  return store.get().filter((run) => run.workspace_id === workspaceId);
}
