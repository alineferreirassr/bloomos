import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { MetricUnit, TimeWindow, MetricSeriesPoint } from "@/types/analytics";
import type { ReportCategory, ReportDimensionKey, ReportFilter, ReportFilterKey } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42 — the canonical Report Metric Registry's own entry
 * shape. Deliberately mirrors `MetricDefinition` (`types/analytics.ts`,
 * Checkpoint 15) field-for-field where the concepts overlap — `id`/`name`/
 * `description`/`category`/`unit`/`requiredPermissions`/`compute` — so
 * every existing `MetricDefinition` in `core/analytics/metricRegistry.ts`
 * can be adapted into a `ReportMetricDefinition` with a thin wrapper
 * (`core/reporting/metricAdapters.ts`) rather than re-authored. What's
 * genuinely new here: `sourceModule`/`sourceEngine` (the audit-trail every
 * metric must document per this checkpoint's own spec),
 * `supportedDimensions`/`supportedFilters` (metrics outside the old
 * time-windowed system have real dimensions to group/filter by), `applies`
 * (many source engines are workspace-state, not time-series — an
 * "applicable" check standing in for a permission-only gate), and
 * `knownLimitations` (surfaced directly in the Report Builder's own metric
 * picker, never buried in a code comment only a developer sees).
 */

export type ReportMetricAggregation = "sum" | "average" | "rate" | "count" | "latest" | "ratio";
export const REPORT_METRIC_AGGREGATIONS = ["sum", "average", "rate", "count", "latest", "ratio"] as const satisfies readonly ReportMetricAggregation[];

export type ReportMetricFreshness = "realtime" | "cacheable" | "periodic";

export interface ReportMetricContext {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
  window: TimeWindow;
  comparisonWindow: TimeWindow | null;
  filters: ReportFilter[];
}

/** `notApplicableReason` is set instead of fabricating a `0`/`null` silently — the same discipline `HealthCategoryScore.notApplicableReason` already established repo-wide. `stale`/`partial` let the Computation Engine build a `ReportSourceDiagnostic` without every metric having to construct one itself. */
export interface ReportMetricResult {
  value: number | null;
  previousValue: number | null;
  unit: MetricUnit;
  series: MetricSeriesPoint[];
  breakdown: { key: string; label: string; value: number }[];
  notApplicableReason: string | null;
  stale: boolean;
  partial: boolean;
}

export interface ReportMetricDefinition {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  unit: MetricUnit;
  aggregation: ReportMetricAggregation;
  /** The real module this metric's numbers come from — e.g. `"Search Platform"`. Documentation, not a permission gate. */
  sourceModule: string;
  /** The real function this metric wraps — e.g. `"computeSearchAnalytics()"`. Never a description of logic reimplemented here. */
  sourceEngine: string;
  supportedDimensions: ReportDimensionKey[];
  supportedFilters: ReportFilterKey[];
  freshness: ReportMetricFreshness;
  requiredPermissions: Permission[];
  /** Same three-gate visibility contract `core/analytics/discovery.ts`'s `listVisibleMetrics()` already established (permissions, then role, then feature flag) — `core/reporting/discovery.ts` applies these identically, so a metric hidden from the old Analytics dashboard stays hidden from the Reporting Platform too. */
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  knownLimitations: string[];
  compute: (context: ReportMetricContext) => Promise<ReportMetricResult>;
}
