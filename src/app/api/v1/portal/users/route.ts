import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { toApiPortalUser } from "@/core/api/mappers";
import { getClientAccountsForWorkspace } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 9 — `GET /api/v1/portal/users`. `portal.read` scope. Reuses `getClientAccountsForWorkspace()`, the workspace-wide read this checkpoint added to `ClientAccessRepository` for API-Key callers (no `workspace_members` session to derive "current" from). */
export const GET = createApiHandler("portal.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const accounts = await getClientAccountsForWorkspace(auth.workspaceId);
  const sorted = [...accounts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { items, meta } = paginate(sorted, parsePagination(url));
  return apiSuccess(items.map(toApiPortalUser), meta);
});
