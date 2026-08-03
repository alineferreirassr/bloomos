"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinMetrics } from "@/modules/analytics/registerBuiltinMetrics";
import { computeVisibleMetrics } from "@/core/analytics/engine";
import { PERMISSIONS } from "@/core/enums/permission";
import { METRIC_CATEGORIES } from "@/types/analytics";
import type { AnalyticsMetricSnapshot, MetricCategory, TrendWindowKey } from "@/types/analytics";

const GENERIC_ACCESS_ERROR = "The Analytics dashboard isn't available right now.";

registerBuiltinMetrics();

export interface AnalyticsDashboardData {
  windowKey: TrendWindowKey;
  byCategory: Record<MetricCategory, AnalyticsMetricSnapshot[]>;
  /** A curated cross-category subset for the Overview tab (Step 3) — one headline metric per category that has any visible metrics at all, never a full duplicate of every category's own tab. */
  overview: AnalyticsMetricSnapshot[];
}

export type GetAnalyticsDashboardDataResult = { success: true; data: AnalyticsDashboardData } | { success: false; error: string };

function groupByCategory(snapshots: AnalyticsMetricSnapshot[], windowKey: TrendWindowKey): AnalyticsDashboardData {
  const byCategory = Object.fromEntries(METRIC_CATEGORIES.map((category) => [category, [] as AnalyticsMetricSnapshot[]])) as Record<MetricCategory, AnalyticsMetricSnapshot[]>;
  for (const snapshot of snapshots) byCategory[snapshot.metric.category].push(snapshot);

  const overview = METRIC_CATEGORIES.map((category) => byCategory[category][0]).filter((snapshot): snapshot is AnalyticsMetricSnapshot => snapshot !== undefined);

  return { windowKey, byCategory, overview };
}

/**
 * Checkpoint 15 — the one aggregate every Analytics surface reads from
 * (the Overview tab and every per-category tab alike), mirroring
 * `getBloomAIOverview.ts`/`getAutomationDashboardData.ts`'s own "one
 * aggregate, computed fresh" shape. Computes every visible metric once
 * per request — the Engine's own `computeVisibleMetrics` already handles
 * permission/role/feature-flag filtering and per-metric failure isolation
 * (Step 10/11), so this function only has to group the result by category
 * and pick the Overview's own headline subset.
 */
export async function getAnalyticsDashboardData(windowKey: TrendWindowKey): Promise<GetAnalyticsDashboardDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const snapshots = await computeVisibleMetrics({
    workspaceId: session.workspace.id,
    permissions: session.permissions,
    role: session.membership.status === "active" ? session.membership.role : null,
    windowKey,
  });

  return { success: true, data: groupByCategory(snapshots, windowKey) };
}

/**
 * Checkpoint 16, Step 8 — the Public API's own entry point into the same
 * Analytics aggregate, for a request authenticated by a workspace-scoped
 * API Key rather than a member session. An API Key carries only
 * `{apiKeyId, workspaceId, scopes}` — no internal `Permission[]`/role —
 * so there is no member session to resolve here. Since the `analytics.read`
 * scope gate already governs access at the route/handler level
 * (`createApiHandler`), a valid key is treated as full internal "owner"
 * visibility for metric filtering purposes, exactly as an internal owner
 * would see every metric with no permission/role gate excluding it.
 */
export async function getAnalyticsDashboardDataForApiKey(workspaceId: string, windowKey: TrendWindowKey): Promise<AnalyticsDashboardData> {
  const snapshots = await computeVisibleMetrics({
    workspaceId,
    permissions: [...PERMISSIONS],
    role: "owner",
    windowKey,
  });

  return groupByCategory(snapshots, windowKey);
}
