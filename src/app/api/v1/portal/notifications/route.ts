import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parsePagination, paginate } from "@/core/api/pagination";
import { getCoreNotificationsService } from "@/core/notifications";

export const dynamic = "force-dynamic";

/** Checkpoint 16, Step 9 — `GET /api/v1/portal/notifications?unread_only=`. `portal.read` scope. Reuses `getClientPortalNotificationsForWorkspace()`, this checkpoint's own workspace-wide sibling of the per-account `getNotificationsForClientAccount()` — never includes internal-member notifications. */
export const GET = createApiHandler("portal.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread_only") === "true";
  const notifications = await getCoreNotificationsService().getClientPortalNotificationsForWorkspace(auth.workspaceId);
  const filtered = unreadOnly ? notifications.filter((n) => n.read_at === null) : notifications;
  const { items, meta } = paginate(filtered, parsePagination(url));
  return apiSuccess(items, meta);
});
