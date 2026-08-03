import type { MetricCategory, MetricTrendDirection, MetricUnit, TrendWindowKey } from "@/types/analytics";

export interface AnalyticsSummaryMetricFact {
  id: string;
  name: string;
  category: MetricCategory;
  unit: MetricUnit;
  value: number;
  changePercent: number | null;
  trend: MetricTrendDirection;
}

/**
 * Checkpoint 15, Step 6 — the deterministic input Bloom AI is allowed to
 * see for the Executive Summary. Every field here is already-computed
 * (the Analytics Engine's own output) — the model receives numbers and
 * trend directions, never raw records, and is asked only to narrate them.
 */
export interface AnalyticsSummaryContext {
  windowKey: TrendWindowKey;
  metrics: AnalyticsSummaryMetricFact[];
}

export interface AnalyticsExecutiveSummaryModelOutput {
  executiveSummary: string;
  operationalRisks: string[];
  performanceHighlights: string[];
  recommendations: string[];
}
