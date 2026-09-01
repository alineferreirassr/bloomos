import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getWorkflowManager } from "@/core/workflow/manager";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/**
 * Checkpoint 16, Step 7 — `GET /api/v1/workflows/:id`. `workflow.read` scope.
 * Phase 09B — scoped to `auth.workspaceId` (never a client-supplied value)
 * so a valid `workflow.read` key from one workspace can't disclose another
 * workspace's Workflow by guessing/enumerating its id. A cross-workspace
 * Workflow and a nonexistent one both raise the identical `not_found`
 * error, matching this endpoint's own pre-existing convention for an
 * unknown id — no new distinguishable response was introduced.
 */
export const GET = createApiHandler<{ id: string }>("workflow.read", async (_request, auth, { id }): Promise<NextResponse> => {
  const workflow = await getWorkflowManager().getWorkflowById(id, auth.workspaceId);
  if (!workflow) throw new ApiError("not_found", `No workflow with id "${id}" was found.`);
  return apiSuccess(workflow);
});
