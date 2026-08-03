import type { AnalyticsMetricSnapshot } from "@/types/analytics";
import type { TrendWindowKey } from "@/types/analytics";
import type { AnalyticsSummaryContext } from "@/modules/analytics/aiSummary/types";

/** Pure — flattens the Engine's own computed snapshots into the narrow, narrative-only fact shape the model is allowed to see. No I/O, no AI call. */
export function buildAnalyticsSummaryContext(windowKey: TrendWindowKey, snapshots: AnalyticsMetricSnapshot[]): AnalyticsSummaryContext {
  return {
    windowKey,
    metrics: snapshots.map((snapshot) => ({
      id: snapshot.metric.id,
      name: snapshot.metric.name,
      category: snapshot.metric.category,
      unit: snapshot.metric.unit,
      value: snapshot.result.value,
      changePercent: snapshot.result.changePercent,
      trend: snapshot.result.trend,
    })),
  };
}
