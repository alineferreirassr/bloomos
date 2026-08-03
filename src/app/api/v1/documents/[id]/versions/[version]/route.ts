import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { getDocumentsManager } from "@/core/documents/manager";
import { ApiError } from "@/core/api/errors";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/documents/:id/versions/:version`. `documents.read` scope. */
export const GET = createApiHandler<{ id: string; version: string }>("documents.read", async (_request, _auth, { id, version }): Promise<NextResponse> => {
  const versionNumber = Number.parseInt(version, 10);
  if (!Number.isFinite(versionNumber)) throw new ApiError("invalid_request", "The version segment must be a whole number.");

  const documentVersion = await getDocumentsManager().getDocumentVersion(id, versionNumber);
  if (!documentVersion) throw new ApiError("not_found", `No version ${version} was found for document "${id}".`);
  return apiSuccess(documentVersion);
});
