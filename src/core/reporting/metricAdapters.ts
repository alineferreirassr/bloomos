import { listMetrics } from "@/core/analytics/metricRegistry";
import type { MetricCategory, MetricDefinition } from "@/types/analytics";
import type { ReportCategory } from "@/types/reporting";
import type { ReportMetricContext, ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — adapts every `MetricDefinition` already registered
 * in `core/analytics/metricRegistry.ts` (Checkpoint 15's Executive
 * Analytics Platform) into this checkpoint's own `ReportMetricDefinition`
 * shape, so the Report Builder's metric picker includes every one of them
 * without a single line of that registry, its Engine, or its 6 metric
 * files being touched or re-authored. `revenueMetrics.ts`/`clientMetrics.ts`/
 * `documentMetrics.ts`/`workflowMetrics.ts`/`aiMetrics.ts`/`portalMetrics.ts`
 * keep computing exactly what they always computed; this file only wraps
 * the call.
 */

/** `MetricCategory` (Checkpoint 15, 10 values scoped to the Analytics dashboard's own tabs) mapped onto this checkpoint's own, slightly broader `ReportCategory` — a deliberate editorial choice, not a structural one, documented here since it's the one place the two category systems meet. */
const METRIC_CATEGORY_TO_REPORT_CATEGORY: Record<MetricCategory, ReportCategory> = {
  revenue: "finance",
  clients: "commercial",
  events: "operations",
  documents: "operations",
  workflow: "automation",
  ai: "executive",
  portal: "commercial",
  finance: "finance",
  operations: "operations",
  health: "executive",
};

function adaptMetricDefinition(definition: MetricDefinition): ReportMetricDefinition {
  return {
    id: `analytics.${definition.id}`,
    name: definition.name,
    description: definition.description,
    category: METRIC_CATEGORY_TO_REPORT_CATEGORY[definition.category],
    unit: definition.unit,
    aggregation: "latest",
    sourceModule: "Executive Analytics Platform (Checkpoint 15)",
    sourceEngine: `core/analytics/metricRegistry.ts ("${definition.id}")`,
    supportedDimensions: ["time"],
    supportedFilters: [],
    freshness: definition.refreshPolicy,
    requiredPermissions: definition.requiredPermissions,
    featureFlag: definition.featureFlag,
    minimumRole: definition.minimumRole,
    knownLimitations: ["Adapted from the pre-existing Analytics Metric Registry — only the time-window dimension is supported; no further grouping or filtering."],
    compute: async (context: ReportMetricContext): Promise<ReportMetricResult> => {
      const result = await definition.compute({
        workspaceId: context.workspaceId,
        window: context.window,
        previousWindow: context.comparisonWindow ?? context.window,
        permissions: context.permissions,
        role: context.role ?? "staff",
      });
      return {
        value: result.value,
        previousValue: result.previousValue,
        unit: definition.unit,
        series: result.series,
        breakdown: [],
        notApplicableReason: null,
        stale: false,
        partial: false,
      };
    },
  };
}

/** The one function `registerBuiltinReportMetrics.ts` calls to bring in every already-registered Analytics metric — never re-derives their category list or count. */
export function adaptRegisteredAnalyticsMetrics(): ReportMetricDefinition[] {
  return listMetrics().map(adaptMetricDefinition);
}
