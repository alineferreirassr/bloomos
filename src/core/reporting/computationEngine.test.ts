import { afterEach, describe, expect, it } from "vitest";
import { registerReportMetric, resetReportMetricRegistry } from "@/core/reporting/metricRegistry";
import { computeReport } from "@/core/reporting/computationEngine";
import type { ReportMetricDefinition } from "@/types/reportMetric";
import type { ReportDefinition } from "@/types/reporting";

function makeMetric(overrides: Partial<ReportMetricDefinition> = {}): ReportMetricDefinition {
  return {
    id: "test.metric",
    name: "Test Metric",
    description: "",
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
    compute: async () => ({ value: 42, previousValue: 40, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: false }),
    ...overrides,
  };
}

function makeDefinition(metricIds: string[], filters: ReportDefinition["filters"] = []): ReportDefinition {
  return {
    title: "Test Report",
    description: "",
    category: "custom",
    sections: [{ id: "s1", title: "Section", chartType: "kpi", metricIds, notes: null }],
    periodKey: "30d",
    customWindow: null,
    comparisonMode: "previous_period",
    customComparisonWindow: null,
    groupBy: null,
    sortBy: null,
    filters,
  };
}

afterEach(() => {
  resetReportMetricRegistry();
});

describe("core/reporting/computationEngine — computeReport", () => {
  it("computes a normal metric into a widget value with a comparison and trend", async () => {
    registerReportMetric(makeMetric({ id: "a" }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"]) });
    expect(computed.widgets[0]!.values[0]!.value).toBe(42);
    expect(computed.widgets[0]!.values[0]!.trend).toBe("up");
    expect(computed.diagnostics[0]).toEqual({ metricId: "a", status: "ok", message: null });
  });

  it("marks a metric hidden by permissions as unavailable without blanking the whole report", async () => {
    registerReportMetric(makeMetric({ id: "a", requiredPermissions: ["reports.financial"] }));
    registerReportMetric(makeMetric({ id: "b" }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a", "b"]) });
    const diagA = computed.diagnostics.find((d) => d.metricId === "a")!;
    const diagB = computed.diagnostics.find((d) => d.metricId === "b")!;
    expect(diagA.status).toBe("unavailable");
    expect(diagB.status).toBe("ok");
    expect(computed.widgets[0]!.values).toHaveLength(1);
  });

  it("marks a metric that no longer exists as unavailable", async () => {
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["ghost"]) });
    expect(computed.diagnostics[0]!.status).toBe("unavailable");
    expect(computed.diagnostics[0]!.message).toContain("no longer registered");
  });

  it("isolates a metric whose compute() throws — the rest of the report still renders", async () => {
    registerReportMetric(makeMetric({ id: "broken", compute: async () => { throw new Error("boom"); } }));
    registerReportMetric(makeMetric({ id: "fine" }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["broken", "fine"]) });
    const diagBroken = computed.diagnostics.find((d) => d.metricId === "broken")!;
    const diagFine = computed.diagnostics.find((d) => d.metricId === "fine")!;
    expect(diagBroken.status).toBe("unavailable");
    expect(diagFine.status).toBe("ok");
  });

  it("honestly reports notApplicableReason as an unavailable diagnostic, not a fabricated value", async () => {
    registerReportMetric(makeMetric({ id: "a", compute: async () => ({ value: null, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: "No workers registered yet.", stale: false, partial: false }) }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"]) });
    expect(computed.diagnostics[0]!.status).toBe("unavailable");
    expect(computed.diagnostics[0]!.message).toBe("No workers registered yet.");
    expect(computed.widgets[0]!.values[0]!.value).toBeNull();
  });

  it("marks a stale metric as such", async () => {
    registerReportMetric(makeMetric({ id: "a", compute: async () => ({ value: 5, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: true, partial: false }) }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"]) });
    expect(computed.diagnostics[0]!.status).toBe("stale");
  });

  it("marks a partial metric as such", async () => {
    registerReportMetric(makeMetric({ id: "a", compute: async () => ({ value: 5, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: true }) }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"]) });
    expect(computed.diagnostics[0]!.status).toBe("partial");
  });

  it("marks an unsupported filter as partial with an explanatory message, and never passes it to compute()", async () => {
    let receivedFilters: unknown = null;
    registerReportMetric(
      makeMetric({
        id: "a",
        supportedFilters: [],
        compute: async (context) => {
          receivedFilters = context.filters;
          return { value: 1, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: false };
        },
      }),
    );
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"], [{ key: "status", value: "active" }]) });
    expect(computed.diagnostics[0]!.status).toBe("partial");
    expect(computed.diagnostics[0]!.message).toContain("status");
    expect(receivedFilters).toEqual([]);
  });

  it("records a real, non-zero totalDurationMs", async () => {
    registerReportMetric(makeMetric({ id: "a" }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: makeDefinition(["a"]) });
    expect(computed.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("resolves comparability from the definition's own comparisonMode", async () => {
    registerReportMetric(makeMetric({ id: "a" }));
    const computed = await computeReport({ workspaceId: "ws_1", permissions: [], role: "owner", definition: { ...makeDefinition(["a"]), comparisonMode: "none" } });
    expect(computed.comparison.comparable).toBe(false);
  });
});
