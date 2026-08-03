import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getDocumentsManager } from "@/core/documents/manager";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/templates/:id`. `documents.read` scope. */
export const GET = createApiHandler<{ id: string }>("documents.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const template = await getDocumentsManager().getTemplateById(id);
  if (!template) throw new ApiError("not_found", `No template with id "${id}" was found.`);
  return apiSuccess(template);
});
