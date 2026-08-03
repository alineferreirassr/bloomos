import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getWorkflowTemplate } from "@/core/workflow/templateRegistry";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 7 — `GET /api/v1/workflow-templates/:id`. `workflow.read` scope. */
export const GET = createApiHandler<{ id: string }>("workflow.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const template = getWorkflowTemplate(id);
  if (!template) throw new ApiError("not_found", `No workflow template with id "${id}" was found.`);
  return apiSuccess(template);
});
