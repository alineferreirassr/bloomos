import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { getWorkflowManager } from "@/core/workflow/manager";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 7 — `GET /api/v1/workflows`. `workflow.read` scope. Reuses `getWorkflowManager().listWorkflows()` unchanged. Never an execution path — this checkpoint's own stop condition ("Do not execute workflows") means there is no corresponding "run" endpoint anywhere in this API. */
export const GET = createApiHandler("workflow.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const workflows = await getWorkflowManager().listWorkflows(auth.workspaceId);
  const sorted = [...workflows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
