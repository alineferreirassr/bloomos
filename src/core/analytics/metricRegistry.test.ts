import { afterEach, describe, expect, it } from "vitest";
import { getMetric, listMetrics, listMetricsByCategory, registerMetric, resetMetricRegistry, unregisterMetric } from "@/core/analytics/metricRegistry";
import type { MetricDefinition } from "@/types/analytics";

function makeMetric(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: "test.metric",
    name: "Test Metric",
    description: "A test metric.",
    category: "revenue",
    unit: "count",
    icon: "DollarSign",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    refreshPolicy: "realtime",
    compute: async () => ({ value: 1, previousValue: null, changePercent: null, trend: "flat" as const, series: [] }),
    ...overrides,
  };
}

afterEach(() => {
  resetMetricRegistry();
});

describe("Metrics Registry", () => {
  it("registers and retrieves a metric by id", () => {
    registerMetric(makeMetric());
    expect(getMetric("test.metric")?.name).toBe("Test Metric");
  });

  it("returns undefined for an unregistered id", () => {
    expect(getMetric("ghost.metric")).toBeUndefined();
  });

  it("re-registering the same id replaces the entry (Map semantics, no duplicate-id guard needed)", () => {
    registerMetric(makeMetric({ name: "First" }));
    registerMetric(makeMetric({ name: "Second" }));
    expect(listMetrics()).toHaveLength(1);
    expect(getMetric("test.metric")?.name).toBe("Second");
  });

  it("lists every registered metric", () => {
    registerMetric(makeMetric({ id: "a" }));
    registerMetric(makeMetric({ id: "b" }));
    expect(listMetrics().map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by category", () => {
    registerMetric(makeMetric({ id: "rev", category: "revenue" }));
    registerMetric(makeMetric({ id: "wf", category: "workflow" }));
    expect(listMetricsByCategory("workflow").map((m) => m.id)).toEqual(["wf"]);
  });

  it("unregisters a metric", () => {
    registerMetric(makeMetric());
    unregisterMetric("test.metric");
    expect(getMetric("test.metric")).toBeUndefined();
  });

  it("resetMetricRegistry clears every entry", () => {
    registerMetric(makeMetric({ id: "a" }));
    registerMetric(makeMetric({ id: "b" }));
    resetMetricRegistry();
    expect(listMetrics()).toHaveLength(0);
  });
});
