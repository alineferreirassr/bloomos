import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getDocumentsManager } from "@/core/documents/manager";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/documents/:id/versions`. `documents.read` scope. */
export const GET = createApiHandler<{ id: string }>("documents.read", async (_request, _auth, { id }): Promise<NextResponse> => {
  const versions = await getDocumentsManager().getDocumentVersions(id);
  return apiSuccess(versions);
});
