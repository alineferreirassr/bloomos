import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { listWorkflowSimulationRuns } from "@/lib/data/core/workflow/simulationStore";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 7 — `GET /api/v1/workflows/:id/simulations`. `workflow.read` scope. Reuses `listWorkflowSimulationRuns()` (Checkpoint 15) unchanged, narrowed to this one Workflow. Simulation history only — never a way to trigger a new one through this API. */
export const GET = createApiHandler<{ id: string }>("workflow.read", async (_request, auth, { id }): Promise<NextResponse> => {
  const runs = listWorkflowSimulationRuns(auth.workspaceId).filter((run) => run.workflow_id === id);
  return apiSuccess(runs);
});
