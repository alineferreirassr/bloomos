import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { getDocumentsManager } from "@/core/documents/manager";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/documents`. `documents.read` scope. Reuses `getDocumentsManager().listComposedDocuments()` unchanged. Returns each Document's own `metadata` alongside its identity — never the full `content` block array in a list response (see `/documents/:id` for the full record, `/documents/:id/download` for a plain-text export). */
export const GET = createApiHandler("documents.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const documents = await getDocumentsManager().listComposedDocuments(auth.workspaceId);
  const summaries = documents.map((document) => ({
    id: document.id,
    templateId: document.templateId,
    documentTypeId: document.documentTypeId,
    status: document.status,
    metadata: document.metadata,
    currentVersion: document.currentVersion,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }));
  const sorted = summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
