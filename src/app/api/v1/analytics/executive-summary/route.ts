import { createApiHandler, NextResponse } from "@/core/api/handler";
import { apiSuccess, apiErrorResponse } from "@/core/api/response";
import { parseTrendWindow } from "@/core/api/trendWindow";
import { generateAnalyticsExecutiveSummaryForApiKey } from "@/modules/analytics/generateAnalyticsExecutiveSummary";

export const dynamic = "force-dynamic";

/**
 * Checkpoint 16, Step 8 — `GET /api/v1/analytics/executive-summary?window=`. `analytics.read` scope.
 * The AI-generated narrative summary (Checkpoint 15's Executive Summary
 * Skill), reused unchanged via `generateAnalyticsExecutiveSummaryForApiKey`.
 * Returns `invalid_request` (never a 500) when Bloom AI itself declines —
 * matching every other Skill-backed surface's own error shape.
 */
export const GET = createApiHandler("analytics.read", async (request, auth): Promise<NextResponse> => {
  const url = new URL(request.url);
  const windowKey = parseTrendWindow(url);
  const result = await generateAnalyticsExecutiveSummaryForApiKey(auth.workspaceId, windowKey);
  if (!result.success) return apiErrorResponse("invalid_request", result.error);
  return apiSuccess(result.data);
});
