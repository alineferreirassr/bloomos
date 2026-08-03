import { describe, expect, it } from "vitest";
import { sortReportValues, groupReportValues } from "@/core/reporting/resultGrouping";
import type { ReportMetricValue } from "@/types/reporting";

function makeValue(overrides: Partial<ReportMetricValue> = {}): ReportMetricValue {
  return {
    metricId: "m",
    label: "Metric",
    unit: "count",
    value: 10,
    previousValue: null,
    changePercent: null,
    trend: "flat",
    series: [],
    breakdown: [],
    notApplicableReason: null,
    ...overrides,
  };
}

describe("core/reporting/resultGrouping — sortReportValues", () => {
  it("returns values unchanged when no sort is given", () => {
    const values = [makeValue({ metricId: "a" }), makeValue({ metricId: "b" })];
    expect(sortReportValues(values, null)).toEqual(values);
  });

  it("sorts by value ascending", () => {
    const values = [makeValue({ metricId: "a", value: 30 }), makeValue({ metricId: "b", value: 10 }), makeValue({ metricId: "c", value: 20 })];
    const sorted = sortReportValues(values, { field: "value", direction: "asc" });
    expect(sorted.map((v) => v.metricId)).toEqual(["b", "c", "a"]);
  });

  it("sorts by value descending", () => {
    const values = [makeValue({ metricId: "a", value: 30 }), makeValue({ metricId: "b", value: 10 })];
    const sorted = sortReportValues(values, { field: "value", direction: "desc" });
    expect(sorted.map((v) => v.metricId)).toEqual(["a", "b"]);
  });

  it("treats a null value as -Infinity when sorting", () => {
    const values = [makeValue({ metricId: "a", value: null }), makeValue({ metricId: "b", value: 5 })];
    const sorted = sortReportValues(values, { field: "value", direction: "asc" });
    expect(sorted.map((v) => v.metricId)).toEqual(["a", "b"]);
  });

  it("sorts by changePercent", () => {
    const values = [makeValue({ metricId: "a", changePercent: 5 }), makeValue({ metricId: "b", changePercent: -5 })];
    const sorted = sortReportValues(values, { field: "changePercent", direction: "asc" });
    expect(sorted.map((v) => v.metricId)).toEqual(["b", "a"]);
  });

  it("sorts by label alphabetically for any other field", () => {
    const values = [makeValue({ metricId: "a", label: "Zebra" }), makeValue({ metricId: "b", label: "Apple" })];
    const sorted = sortReportValues(values, { field: "label", direction: "asc" });
    expect(sorted.map((v) => v.metricId)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const values = [makeValue({ metricId: "a", value: 2 }), makeValue({ metricId: "b", value: 1 })];
    sortReportValues(values, { field: "value", direction: "asc" });
    expect(values.map((v) => v.metricId)).toEqual(["a", "b"]);
  });
});

describe("core/reporting/resultGrouping — groupReportValues", () => {
  it("returns a single 'all' bucket when no grouping is given", () => {
    const values = [makeValue({ metricId: "a" }), makeValue({ metricId: "b" })];
    const groups = groupReportValues(values, null);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("all");
    expect(groups[0]!.values).toHaveLength(2);
  });

  it("buckets a value with no breakdown under its own label", () => {
    const values = [makeValue({ metricId: "a", label: "Revenue", breakdown: [] })];
    const groups = groupReportValues(values, { dimension: "client" });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe("Revenue");
  });

  it("splits a value with a breakdown into one bucket per breakdown entry", () => {
    const values = [makeValue({ metricId: "a", label: "Revenue", breakdown: [{ key: "c1", label: "Client One", value: 100 }, { key: "c2", label: "Client Two", value: 50 }] })];
    const groups = groupReportValues(values, { dimension: "client" });
    expect(groups.map((g) => g.key).sort()).toEqual(["Client One", "Client Two"]);
    const clientOne = groups.find((g) => g.key === "Client One");
    expect(clientOne?.values[0]?.value).toBe(100);
    expect(clientOne?.values[0]?.label).toBe("Revenue — Client One");
  });

  it("merges multiple metrics into the same bucket when their breakdown labels match", () => {
    const values = [
      makeValue({ metricId: "a", label: "Revenue", breakdown: [{ key: "c1", label: "Client One", value: 100 }] }),
      makeValue({ metricId: "b", label: "Bookings", breakdown: [{ key: "c1", label: "Client One", value: 3 }] }),
    ];
    const groups = groupReportValues(values, { dimension: "client" });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.values).toHaveLength(2);
  });
});
