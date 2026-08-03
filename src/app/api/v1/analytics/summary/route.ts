import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess } from "@/core/api/response";
import { parseTrendWindow } from "@/core/api/trendWindow";
import { getAnalyticsDashboardDataForApiKey } from "@/modules/analytics/getAnalyticsDashboardData";

export const dynamic = "force-dynamic";

/**
 * Checkpoint 16, Step 8 — `GET /api/v1/analytics/summary?window=`. `analytics.read` scope.
 * The same grouped-by-category + curated Overview shape the internal
 * Executive Dashboard reads (Checkpoint 15) — "Dashboard summaries" and
 * "KPI Cards" from the spec's own Step 8 bullets are the same `overview`
 * field, not two separate endpoints.
 */
export const GET = createApiHandler("analytics.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const windowKey = parseTrendWindow(url);
  const data = await getAnalyticsDashboardDataForApiKey(auth.workspaceId, windowKey);
  return apiSuccess(data);
});
