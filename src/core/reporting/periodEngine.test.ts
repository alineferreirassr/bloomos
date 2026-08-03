import { describe, expect, it } from "vitest";
import { resolveReportWindow, resolveReportPeriod, buildReportComparison } from "@/core/reporting/periodEngine";

const NOW = new Date("2026-03-15T12:00:00.000Z");

describe("core/reporting/periodEngine — resolveReportWindow", () => {
  it("resolves a rolling window (30d) ending at now", () => {
    const window = resolveReportWindow("30d", null, NOW);
    expect(new Date(window.end).getTime()).toBe(NOW.getTime());
    expect(new Date(window.start).getTime()).toBeLessThan(NOW.getTime());
  });

  it("resolves 'month' to the calendar month start through now", () => {
    const window = resolveReportWindow("month", null, NOW);
    expect(window.start).toBe(new Date(Date.UTC(2026, 2, 1)).toISOString());
    expect(window.end).toBe(NOW.toISOString());
  });

  it("resolves 'quarter' to the calendar quarter start through now", () => {
    const window = resolveReportWindow("quarter", null, NOW);
    expect(window.start).toBe(new Date(Date.UTC(2026, 0, 1)).toISOString());
  });

  it("uses the caller's custom window when periodKey is 'custom'", () => {
    const customWindow = { start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T00:00:00.000Z" };
    expect(resolveReportWindow("custom", customWindow, NOW)).toEqual(customWindow);
  });

  it("falls back to a zero-width window at now when 'custom' has no window supplied", () => {
    const window = resolveReportWindow("custom", null, NOW);
    expect(window.start).toBe(NOW.toISOString());
    expect(window.end).toBe(NOW.toISOString());
  });
});

describe("core/reporting/periodEngine — resolveReportPeriod", () => {
  it("returns both the key and the resolved window", () => {
    const period = resolveReportPeriod("7d", null, NOW);
    expect(period.key).toBe("7d");
    expect(new Date(period.window.end).getTime()).toBe(NOW.getTime());
  });
});

describe("core/reporting/periodEngine — buildReportComparison", () => {
  const currentWindow = { start: "2026-03-01T00:00:00.000Z", end: "2026-03-15T00:00:00.000Z" };

  it("mode 'none' has no comparison window and is not comparable", () => {
    const comparison = buildReportComparison(currentWindow, "none");
    expect(comparison.comparisonWindow).toBeNull();
    expect(comparison.comparable).toBe(false);
  });

  it("mode 'custom' without a supplied window is honestly not comparable", () => {
    const comparison = buildReportComparison(currentWindow, "custom");
    expect(comparison.comparable).toBe(false);
    expect(comparison.missingPeriodReason).toBeTruthy();
  });

  it("mode 'custom' with a supplied window is comparable", () => {
    const customComparisonWindow = { start: "2026-02-01T00:00:00.000Z", end: "2026-02-15T00:00:00.000Z" };
    const comparison = buildReportComparison(currentWindow, "custom", customComparisonWindow);
    expect(comparison.comparisonWindow).toEqual(customComparisonWindow);
    expect(comparison.comparable).toBe(true);
  });

  it("mode 'previous_period' shifts back by the exact span of the current window", () => {
    const comparison = buildReportComparison(currentWindow, "previous_period");
    const spanMs = new Date(currentWindow.end).getTime() - new Date(currentWindow.start).getTime();
    expect(new Date(comparison.comparisonWindow!.end).getTime()).toBe(new Date(currentWindow.start).getTime());
    expect(new Date(comparison.comparisonWindow!.start).getTime()).toBe(new Date(currentWindow.start).getTime() - spanMs);
    expect(comparison.comparable).toBe(true);
  });

  it("mode 'week_over_week' shifts back exactly 7 days", () => {
    const comparison = buildReportComparison(currentWindow, "week_over_week");
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    expect(new Date(comparison.comparisonWindow!.start).getTime()).toBe(new Date(currentWindow.start).getTime() - WEEK_MS);
  });

  it("mode 'month_over_month' shifts back one calendar month", () => {
    const comparison = buildReportComparison(currentWindow, "month_over_month");
    expect(new Date(comparison.comparisonWindow!.start).getUTCMonth()).toBe(1);
  });

  it("mode 'year_over_year' shifts back one calendar year", () => {
    const comparison = buildReportComparison(currentWindow, "year_over_year");
    expect(new Date(comparison.comparisonWindow!.start).getUTCFullYear()).toBe(2025);
  });
});
