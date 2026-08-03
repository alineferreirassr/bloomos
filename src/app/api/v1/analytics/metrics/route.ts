import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parseTrendWindow } from "@/core/api/trendWindow";
import { registerBuiltinMetrics } from "@/modules/analytics/registerBuiltinMetrics";
import { computeVisibleMetrics } from "@/core/analytics/engine";
import { PERMISSIONS } from "@/core/enums/permission";

export const dynamic = "force-dynamic";

registerBuiltinMetrics();

/**
 * Checkpoint 16, Step 8 — `GET /api/v1/analytics/metrics?window=`. `analytics.read` scope.
 * The raw, un-grouped list of every visible metric snapshot for the requested
 * Trend window — reuses `computeVisibleMetrics()` (Checkpoint 15) unchanged.
 * A valid API Key is treated as full internal "owner" visibility, since the
 * `analytics.read` scope gate already governs access at this route.
 */
export const GET = createApiHandler("analytics.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const windowKey = parseTrendWindow(url);
  const snapshots = await computeVisibleMetrics({
    workspaceId: auth.workspaceId,
    permissions: [...PERMISSIONS],
    role: "owner",
    windowKey,
  });
  return apiSuccess(snapshots);
});
