import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { listWorkflowTemplates } from "@/core/workflow/templateRegistry";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 7 — `GET /api/v1/workflow-templates`. `workflow.read` scope. Reuses the global `templateRegistry.ts` unchanged — built-in Templates are the same for every Workspace. */
export const GET = createApiHandler("workflow.read", async (): Promise<NextResponse> => {
  return apiSuccess(listWorkflowTemplates());
});
