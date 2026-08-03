import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { listClientPortalThreadsForWorkspace } from "@/lib/data/clientPortal/clientPortalMessageStore";

export const dynamic = "force-dynamic";

/**
 * Checkpoint 16, Step 9 — `GET /api/v1/portal/messages`. `portal.read`
 * scope. Metadata only, per the spec's own "Messages metadata" bullet — one
 * row per thread (subject, last message time, unread count), never the
 * message bodies themselves. Reuses `listClientPortalThreadsForWorkspace()`,
 * this checkpoint's own workspace-wide sibling of the per-account
 * `getClientPortalMessageThread()`.
 */
export const GET = createApiHandler("portal.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const threads = listClientPortalThreadsForWorkspace(auth.workspaceId);
  const { items, meta } = paginate(threads, parsePagination(url));
  return apiSuccess(items, meta);
});
