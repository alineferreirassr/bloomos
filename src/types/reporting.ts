import type { EntityType } from "@/core/enums/entityType";
import type { MetricUnit, TimeWindow, MetricSeriesPoint } from "@/types/analytics";

/**
 * v2.0 Checkpoint 42 — Reporting & Business Intelligence Platform. The
 * Reporting domain's own types. This is a presentation/composition layer
 * over already-real facts — `TimeWindow`/`MetricSeriesPoint`/`MetricUnit`
 * are reused directly from `types/analytics.ts` (Checkpoint 15's own
 * Metrics Registry), never redeclared with a second shape. See
 * `docs/reporting-platform.md` for the full reuse map this checkpoint's
 * own Step 0 audit produced.
 *
 * Deliberately broader than `MetricCategory` (`types/analytics.ts`, a
 * 10-value set scoped to the Executive Analytics dashboard's own tabs) —
 * a Report can compose metrics that live outside that registry entirely
 * (Workforce, Assets, Communication, Search, Executive), so
 * `ReportCategory` is its own, slightly wider closed set.
 */
export const REPORT_CATEGORIES = ["commercial", "operations", "finance", "workforce", "assets", "automation", "communication", "search", "executive", "custom"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_PERIOD_KEYS = ["today", "7d", "30d", "90d", "month", "quarter", "year", "custom"] as const;
export type ReportPeriodKey = (typeof REPORT_PERIOD_KEYS)[number];

/** A resolved period — `window` is always a real `[start, end)` pair; `key` records which named period (or `"custom"`) produced it, so the UI can re-select the same option without re-deriving the math. */
export interface ReportPeriod {
  key: ReportPeriodKey;
  window: TimeWindow;
}

export const REPORT_COMPARISON_MODES = ["previous_period", "year_over_year", "month_over_month", "week_over_week", "custom", "none"] as const;
export type ReportComparisonMode = (typeof REPORT_COMPARISON_MODES)[number];

/**
 * The Comparison Engine's own output (Step 5's own list: "absolute change,
 * percentage change, trend direction, comparable or not comparable,
 * missing-period disclosure"). `comparisonWindow: null` together with
 * `comparable: false` is the honest state for `mode: "none"` or for a
 * custom window with no real prior data — never a fabricated period.
 */
export interface ReportComparisonResult {
  mode: ReportComparisonMode;
  currentWindow: TimeWindow;
  comparisonWindow: TimeWindow | null;
  comparable: boolean;
  missingPeriodReason: string | null;
}

export const REPORT_DIMENSIONS = [
  "time",
  "day",
  "week",
  "month",
  "quarter",
  "year",
  "client",
  "lead",
  "event",
  "service",
  "proposal",
  "contract",
  "invoice",
  "payment_status",
  "owner",
  "team_member",
  "worker",
  "vendor",
  "asset_type",
  "workflow",
  "notification_category",
  "journey_stage",
  "health_band",
  "status",
  "workspace",
] as const;
export type ReportDimensionKey = (typeof REPORT_DIMENSIONS)[number];

export const REPORT_FILTER_KEYS = ["date_range", "status", "owner", "team", "category", "client", "service", "event", "priority", "health", "readiness", "archived", "tags", "amount_range"] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export type ReportFilterValue = string | string[] | boolean | { min: number; max: number } | { start: string; end: string };

/** A filter is only ever applied inside a metric's own already-permission-checked `compute()` (see `docs/report-filters.md`) — this type carries no query semantics of its own, so it can never bypass a module's own access boundary. */
export interface ReportFilter {
  key: ReportFilterKey;
  value: ReportFilterValue;
}

export interface ReportSort {
  field: string;
  direction: "asc" | "desc";
}

export interface ReportGrouping {
  dimension: ReportDimensionKey;
}

export const REPORT_CHART_TYPES = ["kpi", "trend", "line", "bar", "pie", "table", "ranking", "health", "scorecard", "comparison", "activity"] as const;
export type ReportChartType = (typeof REPORT_CHART_TYPES)[number];

/** One configured slice of a report — "what to show and how," resolved by the Report Computation Engine into a `ReportWidget` (the computed, render-ready counterpart) at request time. */
export interface ReportSection {
  id: string;
  title: string;
  chartType: ReportChartType;
  metricIds: string[];
  notes: string | null;
}

/**
 * The reusable "what this report shows" shape — a `ReportTemplate`'s own
 * `definition` and a `SavedReport`'s persisted fields share this exact
 * type, so a saved report and a template are structurally the same thing,
 * one persisted and one not (Step 7's own "Templates must be definitions
 * over the same Reporting Engine").
 */
export interface ReportDefinition {
  title: string;
  description: string;
  category: ReportCategory;
  sections: ReportSection[];
  periodKey: ReportPeriodKey;
  customWindow: TimeWindow | null;
  comparisonMode: ReportComparisonMode;
  /** Only read when `comparisonMode === "custom"` — every other mode derives its own comparison window mathematically from `currentWindow`. */
  customComparisonWindow: TimeWindow | null;
  groupBy: ReportGrouping | null;
  sortBy: ReportSort | null;
  filters: ReportFilter[];
}

/**
 * The persisted entity — `Report` (the checkpoint's own name for it) is a
 * type alias, not a second shape, since every field a "Report" needs is
 * already here. Favorite/Pinned/Recent status is deliberately NOT stored
 * on this row — it's derived by querying the existing, generic
 * `WorkspaceFavorite`/`WorkspaceRecentItem` stores (Checkpoint 38) filtered
 * to `entity_type: "report"`, never a second favorites/recents concept;
 * see `docs/reporting-ui.md`.
 */
export interface SavedReport extends ReportDefinition {
  id: string;
  workspace_id: string;
  created_by_member_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  /** Set when this report was created from a `ReportTemplate` — `null` for a from-scratch custom report. Never re-synced after creation; editing a report never mutates its template. */
  source_template_id: string | null;
}

export type Report = SavedReport;

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  /** Every template ships with BloomOS itself — Step 20's "Custom Report" is the one non-built-in entry, representing a from-scratch report a member builds themselves. */
  builtIn: boolean;
  definition: ReportDefinition;
}

export type ReportSourceStatus = "ok" | "unavailable" | "stale" | "partial";

/** One line of the Computation Engine's own "never let one bad source blank the whole report" diagnostics (Step 4's own requirement). */
export interface ReportSourceDiagnostic {
  metricId: string;
  status: ReportSourceStatus;
  message: string | null;
}

/** The Metric Registry's own computed value for one metric, inside one report — see `types/reportMetric.ts` for the registry entry this was computed from. */
export interface ReportMetricValue {
  metricId: string;
  label: string;
  unit: MetricUnit;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  trend: "up" | "down" | "flat";
  series: MetricSeriesPoint[];
  breakdown: { key: string; label: string; value: number }[];
  notApplicableReason: string | null;
}

/** The render-ready counterpart to `ReportSection` — what the UI actually draws, with every metric already computed. */
export interface ReportWidget {
  section: ReportSection;
  values: ReportMetricValue[];
}

/**
 * Immutable — Step "Report Snapshots" own contract exactly: "preserve
 * report definition, metric values, filters, comparison period, generated
 * timestamp, source timestamps, acting user, workspace, diagnostics… never
 * overwrite previous snapshots." No `updated_at` on this type on purpose —
 * a snapshot that could be edited wouldn't be a snapshot.
 */
export interface ReportSnapshot {
  id: string;
  report_id: string;
  workspace_id: string;
  definition: ReportDefinition;
  values: ReportMetricValue[];
  comparison: ReportComparisonResult;
  diagnostics: ReportSourceDiagnostic[];
  /** One ISO timestamp per source metric — when that metric's own underlying data was last known-fresh, not when the snapshot itself was taken. */
  source_timestamps: Record<string, string>;
  generated_at: string;
  generated_by_member_id: string;
}

/**
 * Explicitly disabled — Step "Report Snapshots" own instruction: "Do not
 * create a background scheduler yet. Scheduled reports remain a clearly
 * labeled placeholder." `enabled` is always `false` this checkpoint; the
 * type exists so a future integration/background-processing checkpoint has
 * a real shape to fill in rather than inventing one from scratch.
 */
export interface ReportSchedulePlaceholder {
  enabled: false;
  reason: string;
}

export const REPORT_EXPORT_FORMATS = ["csv", "xlsx", "pdf", "print"] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

/** A generated Insight (Step "Executive Reporting"'s own "Critical Risks, Opportunities, Recent Improvements, Recent Regressions") — always derived from an already-computed `ReportMetricValue`/comparison, never a fabricated observation. */
export interface ReportInsight {
  id: string;
  label: string;
  message: string;
  severity: "critical" | "warning" | "info" | "positive";
  relatedMetricId: string | null;
}

/** A named collection of already-computed widgets — the render model for `/reports/[id]` and for the Executive Overview extension (Step 16). */
export interface ReportDashboard {
  report: SavedReport;
  widgets: ReportWidget[];
  comparison: ReportComparisonResult;
  diagnostics: ReportSourceDiagnostic[];
  insights: ReportInsight[];
}

/** Entity types this checkpoint's own audit found genuinely need to be Timeline-capable for Reporting — just `"report"` itself; see `docs/reporting-platform.md`'s Knowledge Graph section for why nothing else was promoted. */
export const REPORT_TIMELINE_OWNER_TYPE: EntityType = "report";
