import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { evaluatePlatformAction } from "@/modules/digitalAssets/digitalAssetsActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — Assets category. Every metric wraps the single real
 * `evaluatePlatformAction()` (Digital Asset Management Platform,
 * Checkpoint 25/37) — its own `{health, analytics}` pair, computed once
 * and never re-derived here.
 */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

const totalAssets: ReportMetricDefinition = {
  id: "assets.total",
  name: "Total Assets",
  description: "Total files in the Asset Library.",
  category: "assets",
  unit: "count",
  aggregation: "count",
  sourceModule: "Digital Asset Management Platform (Checkpoint 25/37)",
  sourceEngine: "evaluatePlatformAction() — analytics.totalAssets",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluatePlatformAction();
    return result(r.success ? r.data.analytics.totalAssets : null, "count");
  },
};

const totalStorage: ReportMetricDefinition = {
  id: "assets.total_storage",
  name: "Asset Storage",
  description: "Total storage consumed by the Asset Library, in bytes.",
  category: "assets",
  unit: "count",
  aggregation: "sum",
  sourceModule: "Digital Asset Management Platform (Checkpoint 25/37)",
  sourceEngine: "evaluatePlatformAction() — analytics.totalStorageBytes",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Reported in bytes — the UI is responsible for human-readable formatting.", "Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluatePlatformAction();
    return result(r.success ? r.data.analytics.totalStorageBytes : null, "count");
  },
};

const unusedAssetCount: ReportMetricDefinition = {
  id: "assets.unused_count",
  name: "Unused Assets",
  description: "Assets with no relationships, no views, and no downloads.",
  category: "assets",
  unit: "count",
  aggregation: "count",
  sourceModule: "Digital Asset Management Platform (Checkpoint 25/37)",
  sourceEngine: "evaluatePlatformAction() — analytics.unusedAssetCount",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluatePlatformAction();
    return result(r.success ? r.data.analytics.unusedAssetCount : null, "count");
  },
};

const assetHealthScore: ReportMetricDefinition = {
  id: "assets.health_score",
  name: "Asset Health",
  description: "Average asset health score across the Asset Library.",
  category: "assets",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Digital Asset Management Platform (Checkpoint 25/37)",
  sourceEngine: "evaluatePlatformAction() — health.averageScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluatePlatformAction();
    return result(r.success ? r.data.health.averageScore : null, "percent");
  },
};

export function registerAssetReportMetrics(): void {
  registerReportMetric(totalAssets);
  registerReportMetric(totalStorage);
  registerReportMetric(unusedAssetCount);
  registerReportMetric(assetHealthScore);
}
