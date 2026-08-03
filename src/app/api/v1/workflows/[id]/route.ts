import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getWorkflowManager } from "@/core/workflow/manager";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 7 — `GET /api/v1/workflows/:id`. `workflow.read` scope. */
export const GET = createApiHandler<{ id: string }>("workflow.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const workflow = await getWorkflowManager().getWorkflowById(id);
  if (!workflow) throw new ApiError("not_found", `No workflow with id "${id}" was found.`);
  return apiSuccess(workflow);
});
