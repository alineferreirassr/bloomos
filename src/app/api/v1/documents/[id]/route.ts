import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getDocumentsManager } from "@/core/documents/manager";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/documents/:id`. `documents.read` scope. The full record, including `content` — unlike the list endpoint's own summary shape. */
export const GET = createApiHandler<{ id: string }>("documents.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const document = await getDocumentsManager().getComposedDocumentById(id);
  if (!document) throw new ApiError("not_found", `No document with id "${id}" was found.`);
  return apiSuccess(document);
});
