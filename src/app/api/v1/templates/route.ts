import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { getDocumentsManager } from "@/core/documents/manager";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 6 — `GET /api/v1/templates`. `documents.read` scope. Reuses `getDocumentsManager().listTemplates()` unchanged. */
export const GET = createApiHandler("documents.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const templates = await getDocumentsManager().listTemplates(auth.workspaceId);
  const sorted = [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items, meta);
});
