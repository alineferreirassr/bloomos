import { describe, expect, it, beforeEach } from "vitest";
import { registerReportMetric, unregisterReportMetric, getReportMetric, listReportMetrics, listReportMetricsByCategory, resetReportMetricRegistry } from "@/core/reporting/metricRegistry";
import type { ReportMetricDefinition } from "@/types/reportMetric";

function makeMetric(overrides: Partial<ReportMetricDefinition> = {}): ReportMetricDefinition {
  return {
    id: "test.metric",
    name: "Test Metric",
    description: "A metric for tests.",
    category: "custom",
    unit: "count",
    aggregation: "sum",
    sourceModule: "Test",
    sourceEngine: "test()",
    supportedDimensions: [],
    supportedFilters: [],
    freshness: "realtime",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    knownLimitations: [],
    compute: async () => ({ value: 1, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: false }),
    ...overrides,
  };
}

describe("core/reporting/metricRegistry", () => {
  beforeEach(() => {
    resetReportMetricRegistry();
  });

  it("registers and retrieves a metric by id", () => {
    registerReportMetric(makeMetric());
    expect(getReportMetric("test.metric")?.name).toBe("Test Metric");
  });

  it("returns undefined for an unknown metric id", () => {
    expect(getReportMetric("does.not.exist")).toBeUndefined();
  });

  it("lists every registered metric", () => {
    registerReportMetric(makeMetric({ id: "a" }));
    registerReportMetric(makeMetric({ id: "b" }));
    expect(listReportMetrics().map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerReportMetric(makeMetric({ id: "a", category: "finance" }));
    registerReportMetric(makeMetric({ id: "b", category: "commercial" }));
    expect(listReportMetricsByCategory("finance").map((m) => m.id)).toEqual(["a"]);
  });

  it("unregisters a metric", () => {
    registerReportMetric(makeMetric({ id: "a" }));
    unregisterReportMetric("a");
    expect(getReportMetric("a")).toBeUndefined();
  });

  it("overwrites a metric registered twice under the same id", () => {
    registerReportMetric(makeMetric({ id: "a", name: "First" }));
    registerReportMetric(makeMetric({ id: "a", name: "Second" }));
    expect(listReportMetrics()).toHaveLength(1);
    expect(getReportMetric("a")?.name).toBe("Second");
  });

  it("resetReportMetricRegistry clears every registered metric", () => {
    registerReportMetric(makeMetric());
    resetReportMetricRegistry();
    expect(listReportMetrics()).toHaveLength(0);
  });
});
