import { describe, expect, it } from "vitest";
import { buildAnalyticsSummaryContext } from "@/modules/analytics/aiSummary/contextBuilder";
import type { AnalyticsMetricSnapshot } from "@/types/analytics";

function snapshot(overrides: Partial<AnalyticsMetricSnapshot["metric"] & AnalyticsMetricSnapshot["result"]> = {}): AnalyticsMetricSnapshot {
  return {
    metric: { id: "revenue.total", name: "Revenue", description: "desc", category: "revenue", unit: "currency", icon: "DollarSign", ...overrides },
    result: { value: 100, previousValue: 50, changePercent: 100, trend: "up", series: [], ...overrides },
  };
}

describe("buildAnalyticsSummaryContext", () => {
  it("flattens snapshots into narrative-only facts — never exposes the compute function or any other registry-only field", () => {
    const context = buildAnalyticsSummaryContext("30d", [snapshot()]);
    expect(context).toEqual({
      windowKey: "30d",
      metrics: [{ id: "revenue.total", name: "Revenue", category: "revenue", unit: "currency", value: 100, changePercent: 100, trend: "up" }],
    });
  });

  it("carries an empty metrics list through unchanged rather than throwing", () => {
    expect(buildAnalyticsSummaryContext("today", [])).toEqual({ windowKey: "today", metrics: [] });
  });
});
