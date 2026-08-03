import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

/**
 * Checkpoint 15 — the Executive Analytics Platform's own closed set of
 * dashboard categories. Mirrors the "small closed set" bias
 * `AutomationTriggerType`/`AICapability` already use: a category names a
 * real dashboard tab (Step 3), so a typo here would silently orphan a
 * metric from its own tab rather than fail loudly.
 */
export const METRIC_CATEGORIES = ["revenue", "clients", "events", "documents", "workflow", "ai", "portal", "finance", "operations", "health"] as const;
export type MetricCategory = (typeof METRIC_CATEGORIES)[number];

/** How a KPI Card's own `value`/`previousValue` should be formatted — the Engine never formats, only the UI layer does, but a metric must declare its own unit so the UI knows how. */
export const METRIC_UNITS = ["currency", "count", "percent", "duration_ms"] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

/**
 * Step 1's own "future caching" — deliberately a declared intent, not a
 * working cache this checkpoint implements (see Non-Goals: no External
 * BI). `"realtime"` metrics are always computed fresh; `"cacheable"`
 * marks a metric a future checkpoint could safely memoize per
 * workspace+window without staleness risk (e.g. an all-time total that
 * rarely needs sub-minute freshness). The Engine treats both identically
 * today — this field exists so that future work is additive, not a
 * breaking change to every registered metric.
 */
export const METRIC_REFRESH_POLICIES = ["realtime", "cacheable"] as const;
export type MetricRefreshPolicy = (typeof METRIC_REFRESH_POLICIES)[number];

/** Step 5's own closed set of Trend windows. "Comparison" isn't its own window — every window already carries a period-over-period comparison, see `MetricComputeResult.trend`. */
export const TREND_WINDOW_KEYS = ["today", "7d", "30d", "90d", "year"] as const;
export type TrendWindowKey = (typeof TREND_WINDOW_KEYS)[number];

export const TREND_WINDOW_LABELS: Record<TrendWindowKey, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  year: "Year",
};

/** A half-open interval `[start, end)`, both ISO 8601 timestamps. */
export interface TimeWindow {
  start: string;
  end: string;
}

export interface MetricComputeContext {
  workspaceId: string;
  window: TimeWindow;
  previousWindow: TimeWindow;
  permissions: Permission[];
  role: WorkspaceMemberRole;
  /**
   * Checkpoint 45A — request-scoped memoization for the zero-arg base-table
   * reads (`getInvoices()`, `getEvents()`, etc.) several metrics in the same
   * `computeVisibleMetrics()` call independently need. `computeVisibleMetrics()`
   * populates this with a cache scoped to that one call; a `compute()`
   * invoked standalone (e.g. in a test) simply won't have it, so callers
   * must fall back to calling `fetcher` directly when it's absent.
   */
  cachedFetch?: <T>(key: string, fetcher: () => Promise<T>) => Promise<T>;
}

/** One bucket of a metric's own time series — `label` is a human-facing bucket name (e.g. an ISO date), never a raw index. */
export interface MetricSeriesPoint {
  label: string;
  value: number;
}

export type MetricTrendDirection = "up" | "down" | "flat";

export interface MetricComputeResult {
  value: number;
  previousValue: number | null;
  /** `null` when a meaningful comparison isn't possible (e.g. `previousValue` is `0` and `value` isn't, or the metric has no prior-period data at all) — never a fabricated `Infinity`/`0`. */
  changePercent: number | null;
  trend: MetricTrendDirection;
  series: MetricSeriesPoint[];
}

/**
 * The Metrics Registry's own registered entry — deliberately mirrors
 * `SkillDefinition`/`AutomationActionDefinition`/`WorkflowNodeDefinition`'s
 * shared shape (`id`/`name`/`description`/`category`/`requiredPermissions`/
 * `featureFlag`/`minimumRole`), the same "look like every other registry
 * in this codebase" discipline every prior checkpoint's own registry
 * followed. `compute` is the one thing that varies per metric — it always
 * reads through an existing module's own data/aggregation functions
 * (`computeWorkspaceFinancialSummary`, `getLeads`, `getWorkflowManager()`,
 * etc.), never duplicates that module's business logic.
 */
export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  unit: MetricUnit;
  icon: string;
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
  refreshPolicy: MetricRefreshPolicy;
  compute: (context: MetricComputeContext) => Promise<MetricComputeResult>;
}

/** A computed metric, ready for a KPI Card — `MetricDefinition`'s own static metadata plus the Engine's own computed result for one specific window. */
export interface AnalyticsMetricSnapshot {
  metric: Pick<MetricDefinition, "id" | "name" | "description" | "category" | "unit" | "icon">;
  result: MetricComputeResult;
}
