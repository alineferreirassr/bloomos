import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { getSearchAnalyticsAction, getSearchHealthAction } from "@/modules/search/searchActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/** v2.0 Checkpoint 42 — Search category. Wraps the real Search Analytics/Health Engines (Checkpoint 40). */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

const totalSearches: ReportMetricDefinition = {
  id: "search.total_searches",
  name: "Searches",
  description: "Total searches performed across the workspace.",
  category: "search",
  unit: "count",
  aggregation: "count",
  sourceModule: "Global Search & Command Center (Checkpoint 40)",
  sourceEngine: "getSearchAnalyticsAction() — totalSearches",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison.", "Gated on workspace.manage, matching /search/analytics's own route gate."],
  async compute() {
    const r = await getSearchAnalyticsAction();
    return result(r.success ? r.data.totalSearches : null, "count");
  },
};

const searchSuccessRate: ReportMetricDefinition = {
  id: "search.success_rate",
  name: "Search Success Rate",
  description: "Share of searches that returned at least one result.",
  category: "search",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Global Search & Command Center (Checkpoint 40)",
  sourceEngine: "getSearchAnalyticsAction() — successRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getSearchAnalyticsAction();
    return result(r.success ? r.data.successRate * 100 : null, "percent");
  },
};

const searchHealthScore: ReportMetricDefinition = {
  id: "search.health_score",
  name: "Search Health",
  description: "Overall Search Health score.",
  category: "search",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Global Search & Command Center (Checkpoint 40)",
  sourceEngine: "getSearchHealthAction() — overallScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workspace.manage"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getSearchHealthAction();
    return result(r.success ? r.data.overallScore : null, "percent");
  },
};

export function registerSearchReportMetrics(): void {
  registerReportMetric(totalSearches);
  registerReportMetric(searchSuccessRate);
  registerReportMetric(searchHealthScore);
}
