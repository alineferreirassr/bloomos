import { describe, expect, it } from "vitest";
import { computeBenchmark, resolveBenchmarkWindow } from "@/core/analytics/benchmarkEngine";

const NOW = new Date("2026-07-29T12:00:00.000Z");

describe("resolveBenchmarkWindow", () => {
  it("thisMonth: calendar month start through now", () => {
    const window = resolveBenchmarkWindow("thisMonth", NOW);
    expect(window).toEqual({ start: "2026-07-01T00:00:00.000Z", end: NOW.toISOString() });
  });

  it("lastMonth: the full prior calendar month", () => {
    const window = resolveBenchmarkWindow("lastMonth", NOW);
    expect(window).toEqual({ start: "2026-06-01T00:00:00.000Z", end: "2026-07-01T00:00:00.000Z" });
  });

  it("sameMonthLastYear: the same calendar month, one year back", () => {
    const window = resolveBenchmarkWindow("sameMonthLastYear", NOW);
    expect(window).toEqual({ start: "2025-07-01T00:00:00.000Z", end: "2025-08-01T00:00:00.000Z" });
  });

  it("rolling30d/rolling90d: exactly N days back from now", () => {
    const thirty = resolveBenchmarkWindow("rolling30d", NOW);
    const ninety = resolveBenchmarkWindow("rolling90d", NOW);
    expect(new Date(thirty.end).getTime() - new Date(thirty.start).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(new Date(ninety.end).getTime() - new Date(ninety.start).getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe("computeBenchmark", () => {
  it("computes all five periods via the caller-supplied function and derives comparisons", async () => {
    const valuesByStart: Record<string, number> = {
      "2026-07-01T00:00:00.000Z": 1000, // thisMonth
      "2026-06-01T00:00:00.000Z": 800, // lastMonth
      "2025-07-01T00:00:00.000Z": 500, // sameMonthLastYear
    };
    const result = await computeBenchmark("Revenue", (window) => valuesByStart[window.start] ?? 0, NOW);
    expect(result.values.find((v) => v.period === "thisMonth")?.value).toBe(1000);
    expect(result.changeVsLastMonthPercent).toBeCloseTo(25);
    expect(result.changeVsSameMonthLastYearPercent).toBeCloseTo(100);
  });

  it("reports null change when the comparison baseline is zero and current is positive", async () => {
    const result = await computeBenchmark("Revenue", (window) => (window.start === "2026-07-01T00:00:00.000Z" ? 500 : 0), NOW);
    expect(result.changeVsLastMonthPercent).toBeNull();
  });

  it("supports an async computeForWindow", async () => {
    const result = await computeBenchmark("Revenue", async (window) => (window.start === "2026-07-01T00:00:00.000Z" ? 42 : 0), NOW);
    expect(result.values.find((v) => v.period === "thisMonth")?.value).toBe(42);
  });
});
