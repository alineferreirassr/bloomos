import type { MetricSeriesPoint } from "@/types/analytics";

/**
 * v2 Checkpoint 23 — Executive Analytics & Business Intelligence Platform.
 * Shared types for the BI engines (`ForecastEngine`, `BusinessHealthEngine`,
 * `BenchmarkEngine`, `ExecutiveInsightsEngine`) and stores
 * (`DashboardLayoutStore`, `GoalsStore`), mirroring `core/operations/types.ts`'s
 * own precedent: one shared type file per checkpoint's reusable-engine layer,
 * kept separate from `types/analytics.ts` (Checkpoint 15's Metric Registry
 * types, which this checkpoint extends but doesn't own).
 */

// ---------------------------------------------------------------------------
// Forecast Engine (Step 8) — deterministic, no external AI.
// ---------------------------------------------------------------------------

export const FORECAST_METHODS = ["linear_regression", "moving_average"] as const;
export type ForecastMethod = (typeof FORECAST_METHODS)[number];

export const FORECAST_CONFIDENCES = ["low", "medium", "high"] as const;
export type ForecastConfidence = (typeof FORECAST_CONFIDENCES)[number];

export interface ForecastResult {
  method: ForecastMethod;
  /** The real historical buckets the projection was fit from. */
  historical: MetricSeriesPoint[];
  /** Future buckets, same label format as `historical` (e.g. `"YYYY-MM"`). */
  projected: MetricSeriesPoint[];
  /** `"low"` under 3 historical points (projection still returned, but the caller should visibly flag it), `"medium"` 3-5, `"high"` 6+. */
  confidence: ForecastConfidence;
  note: string;
}

// ---------------------------------------------------------------------------
// Business Health Engine (Step 10) — a workspace-wide score, distinct from
// (but built on top of) Checkpoint 21's per-event OperationsHealthDetails.
// ---------------------------------------------------------------------------

export const BUSINESS_HEALTH_BANDS = ["excellent", "healthy", "attention", "critical"] as const;
export type BusinessHealthBand = (typeof BUSINESS_HEALTH_BANDS)[number];

export const BUSINESS_HEALTH_BAND_LABELS: Record<BusinessHealthBand, string> = {
  excellent: "Excellent",
  healthy: "Healthy",
  attention: "Attention",
  critical: "Critical",
};

export function businessHealthBandFromScore(score: number): BusinessHealthBand {
  if (score >= 90) return "excellent";
  if (score >= 70) return "healthy";
  if (score >= 45) return "attention";
  return "critical";
}

export const BUSINESS_HEALTH_DIMENSIONS = ["finance", "crm", "operations", "inventory", "team", "events", "payments", "customerSatisfaction", "risk"] as const;
export type BusinessHealthDimension = (typeof BUSINESS_HEALTH_DIMENSIONS)[number];

export const BUSINESS_HEALTH_DIMENSION_LABELS: Record<BusinessHealthDimension, string> = {
  finance: "Finance",
  crm: "CRM",
  operations: "Operations",
  inventory: "Inventory",
  team: "Team",
  events: "Events",
  payments: "Payments",
  customerSatisfaction: "Customer Satisfaction",
  risk: "Risk",
};

export interface BusinessHealthFactor {
  label: string;
  /** Negative = deduction, positive = boost, in score points. */
  impact: number;
}

export interface BusinessHealthDimensionScore {
  dimension: BusinessHealthDimension;
  /** `null` means this dimension has no real data source yet (see `customerSatisfaction`) — excluded from the weighted total rather than counted as a fabricated 0, matching `operationsReportsData.ts`'s "honestly omitted rather than approximated" precedent. */
  score: number | null;
  /** This dimension's normal share of the total (0-1) when data is available; weights of `null`-scored dimensions are redistributed proportionally among the rest. */
  weight: number;
  explanation: string;
  factors: BusinessHealthFactor[];
}

export interface BusinessHealthResult {
  score: number;
  band: BusinessHealthBand;
  dimensions: BusinessHealthDimensionScore[];
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Benchmark Engine (Step 11)
// ---------------------------------------------------------------------------

export const BENCHMARK_PERIODS = ["thisMonth", "lastMonth", "sameMonthLastYear", "rolling30d", "rolling90d"] as const;
export type BenchmarkPeriod = (typeof BENCHMARK_PERIODS)[number];

export const BENCHMARK_PERIOD_LABELS: Record<BenchmarkPeriod, string> = {
  thisMonth: "This Month",
  lastMonth: "Last Month",
  sameMonthLastYear: "Same Month Last Year",
  rolling30d: "Rolling 30 Days",
  rolling90d: "Rolling 90 Days",
};

export interface BenchmarkPeriodValue {
  period: BenchmarkPeriod;
  value: number;
}

export interface BenchmarkResult {
  label: string;
  values: BenchmarkPeriodValue[];
  changeVsLastMonthPercent: number | null;
  changeVsSameMonthLastYearPercent: number | null;
}

// ---------------------------------------------------------------------------
// Executive Insights Engine (Step 12) — deterministic (spec: "Everything
// deterministic"), modeled on `generateExecutiveBrief.ts`'s template
// approach, never the LLM-backed `generateAnalyticsExecutiveSummary`.
// ---------------------------------------------------------------------------

export const EXECUTIVE_INSIGHT_CATEGORIES = ["revenue", "expense", "pipeline", "risk", "growth", "clientTrend", "operationalBottleneck"] as const;
export type ExecutiveInsightCategory = (typeof EXECUTIVE_INSIGHT_CATEGORIES)[number];

export const EXECUTIVE_INSIGHT_CATEGORY_LABELS: Record<ExecutiveInsightCategory, string> = {
  revenue: "Revenue Insights",
  expense: "Expense Insights",
  pipeline: "Pipeline Insights",
  risk: "Risk Summary",
  growth: "Growth Opportunities",
  clientTrend: "Client Trends",
  operationalBottleneck: "Operational Bottlenecks",
};

export const EXECUTIVE_INSIGHT_SEVERITIES = ["info", "positive", "warning", "critical"] as const;
export type ExecutiveInsightSeverity = (typeof EXECUTIVE_INSIGHT_SEVERITIES)[number];

export interface ExecutiveInsight {
  id: string;
  category: ExecutiveInsightCategory;
  severity: ExecutiveInsightSeverity;
  title: string;
  detail: string;
  drillDown: DrillDownTarget | null;
}

// ---------------------------------------------------------------------------
// Drill-down Navigation (Step 13)
// ---------------------------------------------------------------------------

export const DRILL_DOWN_KINDS = ["events", "invoices", "clients", "tasks", "purchases", "documents", "leads", "payments", "expenses", "services"] as const;
export type DrillDownKind = (typeof DRILL_DOWN_KINDS)[number];

export interface DrillDownTarget {
  kind: DrillDownKind;
  label: string;
  /** A real in-app route, optionally with query filters (e.g. `/finance/invoices?status=overdue`) — never a fabricated link. */
  href: string;
}

// ---------------------------------------------------------------------------
// Goals & Targets (Step 9)
// ---------------------------------------------------------------------------

export const GOAL_METRICS = ["monthlyRevenue", "quarterlyRevenue", "annualRevenue", "events", "profit", "conversionRate", "customerSatisfaction"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  monthlyRevenue: "Monthly Revenue",
  quarterlyRevenue: "Quarterly Revenue",
  annualRevenue: "Annual Revenue",
  events: "Events",
  profit: "Profit",
  conversionRate: "Conversion Rate",
  customerSatisfaction: "Customer Satisfaction",
};

export interface Goal {
  id: string;
  workspace_id: string;
  metric: GoalMetric;
  period_start: string;
  period_end: string;
  target_value: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: Goal;
  /** `null` exactly when `metric === "customerSatisfaction"` — no data source exists yet (see `BusinessHealthDimensionScore.score`'s own null-handling precedent). */
  currentValue: number | null;
  progressPercent: number | null;
  onTrack: boolean | null;
}

// ---------------------------------------------------------------------------
// Custom Dashboard Widgets / DashboardLayoutStore (Step 14)
// ---------------------------------------------------------------------------

export interface DashboardWidgetPreference {
  widgetId: string;
  pinned: boolean;
  hidden: boolean;
  order: number;
}

export interface DashboardLayout {
  workspace_id: string;
  member_id: string;
  widgets: DashboardWidgetPreference[];
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Revenue Analytics (Step 2) breakdown dimensions.
// ---------------------------------------------------------------------------

/**
 * `"package"` (spec Step 2) is deliberately not its own dimension — BloomOS's
 * data model has no separate Package entity distinct from Service (see
 * `docs/executive-dashboard.md`'s Known Limitations); "Revenue by Package"
 * and "Revenue by Service" resolve to the identical `"service"` breakdown
 * rather than fabricating a second, redundant grouping.
 */
export const REVENUE_BREAKDOWN_DIMENSIONS = ["month", "week", "day", "event", "service", "client", "source", "team"] as const;
export type RevenueBreakdownDimension = (typeof REVENUE_BREAKDOWN_DIMENSIONS)[number];

export const REVENUE_BREAKDOWN_DIMENSION_LABELS: Record<RevenueBreakdownDimension, string> = {
  month: "By Month",
  week: "By Week",
  day: "By Day",
  event: "By Event",
  service: "By Service",
  client: "By Client",
  source: "By Source",
  team: "By Team",
};

export interface RevenueBreakdownRow {
  key: string;
  label: string;
  revenueMinor: number;
  drillDown: DrillDownTarget | null;
}

export interface RevenueBreakdown {
  dimension: RevenueBreakdownDimension;
  rows: RevenueBreakdownRow[];
  totalMinor: number;
}
