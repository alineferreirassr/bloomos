import { afterEach, describe, expect, it } from "vitest";
import { buildMetricResult, compareTrend, computeVisibleMetrics, filterInWindow, groupByDay, groupByKey, groupByMonth, groupByWeek, resolveCachedFetch, resolveTrendWindow, sumBy } from "@/core/analytics/engine";
import { registerMetric, resetMetricRegistry } from "@/core/analytics/metricRegistry";
import type { MetricDefinition, TimeWindow } from "@/types/analytics";

const NOW = new Date("2026-07-28T12:00:00.000Z");

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

describe("resolveTrendWindow", () => {
  it("today: window from midnight UTC to now, previous window the full prior day", () => {
    const { window, previousWindow } = resolveTrendWindow("today", NOW);
    expect(window).toEqual({ start: "2026-07-28T00:00:00.000Z", end: NOW.toISOString() });
    expect(previousWindow).toEqual({ start: "2026-07-27T00:00:00.000Z", end: "2026-07-28T00:00:00.000Z" });
  });

  it("7d: a rolling 7-day window with an equal-length prior window immediately before it", () => {
    const { window, previousWindow } = resolveTrendWindow("7d", NOW);
    expect(window.end).toBe(NOW.toISOString());
    expect(new Date(window.end).getTime() - new Date(window.start).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(previousWindow.end).toBe(window.start);
    expect(new Date(previousWindow.end).getTime() - new Date(previousWindow.start).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("30d and 90d scale the same rolling-window shape", () => {
    const thirty = resolveTrendWindow("30d", NOW);
    const ninety = resolveTrendWindow("90d", NOW);
    expect(new Date(thirty.window.end).getTime() - new Date(thirty.window.start).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(new Date(ninety.window.end).getTime() - new Date(ninety.window.start).getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("year: calendar-aligned to January 1st, not a rolling 365-day window", () => {
    const { window, previousWindow } = resolveTrendWindow("year", NOW);
    expect(window.start).toBe("2026-01-01T00:00:00.000Z");
    expect(previousWindow).toEqual({ start: "2025-01-01T00:00:00.000Z", end: "2026-01-01T00:00:00.000Z" });
  });
});

describe("compareTrend", () => {
  it("previous null: no comparison exists, reports flat and null changePercent even when current > 0", () => {
    expect(compareTrend(50, null)).toEqual({ changePercent: null, trend: "flat" });
  });

  it("previous 0, current > 0: a real zero baseline that grew — up, but still no fabricated percentage", () => {
    expect(compareTrend(10, 0)).toEqual({ changePercent: null, trend: "up" });
  });

  it("previous 0, current 0: flat", () => {
    expect(compareTrend(0, 0)).toEqual({ changePercent: null, trend: "flat" });
  });

  it("computes a real percentage and classifies up/down/flat around a small dead zone", () => {
    expect(compareTrend(150, 100)).toEqual({ changePercent: 50, trend: "up" });
    expect(compareTrend(50, 100)).toEqual({ changePercent: -50, trend: "down" });
    const nearZero = compareTrend(100.2, 100);
    expect(nearZero.changePercent).toBeCloseTo(0.2);
    expect(nearZero.trend).toBe("flat");
  });
});

describe("buildMetricResult", () => {
  it("bundles value/previousValue/derived trend/series into one MetricComputeResult", () => {
    const result = buildMetricResult(120, 100, [{ label: "2026-07-01", value: 5 }]);
    expect(result).toEqual({ value: 120, previousValue: 100, changePercent: 20, trend: "up", series: [{ label: "2026-07-01", value: 5 }] });
  });

  it("defaults series to an empty array", () => {
    expect(buildMetricResult(1, null).series).toEqual([]);
  });
});

describe("filterInWindow / sumBy", () => {
  const window: TimeWindow = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-08T00:00:00.000Z" };
  const items = [{ at: "2026-06-30T00:00:00.000Z", amount: 10 }, { at: "2026-07-03T00:00:00.000Z", amount: 20 }, { at: "2026-07-08T00:00:00.000Z", amount: 30 }];

  it("filterInWindow is half-open — includes start, excludes end", () => {
    const result = filterInWindow(items, (i) => i.at, window);
    expect(result).toEqual([items[1]]);
  });

  it("sumBy adds a selector's value across items", () => {
    expect(sumBy(items, (i) => i.amount)).toBe(60);
  });
});

describe("filterInWindow — date-only values participate by calendar date (Phase 08 fix)", () => {
  // A window whose start is a full-ISO midnight instant and whose end is a mid-day instant — exactly
  // the shape resolveTrendWindow builds for "today".
  const todayWindow: TimeWindow = { start: "2026-08-17T00:00:00.000Z", end: "2026-08-17T14:30:00.000Z" };

  it("A. date-only value ON the window start date is INCLUDED (was wrongly excluded before the fix)", () => {
    const items = [{ at: "2026-08-17" }];
    expect(filterInWindow(items, (i) => i.at, todayWindow)).toEqual(items);
  });

  it("B. date-only value BEFORE the window start is EXCLUDED", () => {
    const items = [{ at: "2026-08-16" }];
    expect(filterInWindow(items, (i) => i.at, todayWindow)).toEqual([]);
  });

  it("C. exclusive-end preserved: a date-only value equal to an exclusive midnight end is EXCLUDED", () => {
    const endMidnight: TimeWindow = { start: "2026-08-16T00:00:00.000Z", end: "2026-08-17T00:00:00.000Z" };
    expect(filterInWindow([{ at: "2026-08-17" }], (i) => i.at, endMidnight)).toEqual([]);
    // ...while the prior calendar day is still included (inclusive start, by date)
    expect(filterInWindow([{ at: "2026-08-16" }], (i) => i.at, endMidnight)).toEqual([{ at: "2026-08-16" }]);
  });

  it("D. datetime value previously inside the window remains INCLUDED", () => {
    const items = [{ at: "2026-08-17T09:15:00.000Z" }];
    expect(filterInWindow(items, (i) => i.at, todayWindow)).toEqual(items);
  });

  it("E. datetime value previously outside the window remains EXCLUDED", () => {
    expect(filterInWindow([{ at: "2026-08-17T20:00:00.000Z" }], (i) => i.at, todayWindow)).toEqual([]);
    expect(filterInWindow([{ at: "2026-08-16T23:59:59.000Z" }], (i) => i.at, todayWindow)).toEqual([]);
  });

  it("F. today's date-only payment/expense/event value no longer disappears for lacking a T-timestamp", () => {
    const { window } = resolveTrendWindow("today", new Date("2026-08-17T14:30:00.000Z"));
    const payments = [{ transaction_date: "2026-08-17" }, { transaction_date: "2026-08-16" }];
    expect(filterInWindow(payments, (p) => p.transaction_date, window)).toEqual([{ transaction_date: "2026-08-17" }]);
  });

  it("G. rolling-window semantics unchanged for datetime values (7d spans exactly N×24h back from now)", () => {
    const { window } = resolveTrendWindow("7d", new Date("2026-08-17T14:30:00.000Z"));
    const items = [
      { at: "2026-08-17T00:00:00.000Z" }, // inside
      { at: "2026-08-10T14:30:00.000Z" }, // exactly the rolling start — inclusive
      { at: "2026-08-10T14:29:59.000Z" }, // one second before the rolling start — excluded
    ];
    expect(filterInWindow(items, (i) => i.at, window)).toEqual([items[0], items[1]]);
  });
});

describe("groupByDay", () => {
  it("buckets by UTC calendar day, filling every day in the window with 0 even when no item falls on it", () => {
    const window: TimeWindow = { start: "2026-07-01T00:00:00.000Z", end: "2026-07-04T00:00:00.000Z" };
    const items = [{ at: "2026-07-01T10:00:00.000Z", value: 5 }, { at: "2026-07-01T20:00:00.000Z", value: 3 }, { at: "2026-07-03T05:00:00.000Z", value: 7 }];
    const series = groupByDay(items, (i) => i.at, (i) => i.value, window);
    expect(series).toEqual([
      { label: "2026-07-01", value: 8 },
      { label: "2026-07-02", value: 0 },
      { label: "2026-07-03", value: 7 },
    ]);
  });
});

describe("computeVisibleMetrics", () => {
  afterEach(() => {
    resetMetricRegistry();
  });

  it("computes only metrics whose requiredPermissions the caller holds", async () => {
    registerMetric(makeMetric({ id: "visible", requiredPermissions: ["finance.view"] }));
    registerMetric(makeMetric({ id: "hidden", requiredPermissions: ["workspace.manage"] }));

    const snapshots = await computeVisibleMetrics({ workspaceId: "ws_1", permissions: ["finance.view"], role: "owner", windowKey: "30d" });
    expect(snapshots.map((s) => s.metric.id)).toEqual(["visible"]);
  });

  it("never exposes the registered compute function on a returned snapshot (server-action serialization safety)", async () => {
    registerMetric(makeMetric({ id: "safe" }));
    const [snapshot] = await computeVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner", windowKey: "30d" });
    expect(snapshot.metric).not.toHaveProperty("compute");
    expect(Object.keys(snapshot.metric).sort()).toEqual(["category", "description", "icon", "id", "name", "unit"]);
  });

  it("isolates a failing metric's own compute() — one broken metric never breaks the rest", async () => {
    registerMetric(makeMetric({ id: "broken", compute: async () => { throw new Error("boom"); } }));
    registerMetric(makeMetric({ id: "fine", compute: async () => ({ value: 42, previousValue: null, changePercent: null, trend: "flat", series: [] }) }));

    const snapshots = await computeVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner", windowKey: "30d" });
    const broken = snapshots.find((s) => s.metric.id === "broken");
    const fine = snapshots.find((s) => s.metric.id === "fine");
    expect(broken?.result).toEqual({ value: 0, previousValue: null, changePercent: null, trend: "flat", series: [] });
    expect(fine?.result.value).toBe(42);
  });

  it("Checkpoint 45A — shares one context.cachedFetch across every metric's compute(), so an identical key is only fetched once per call", async () => {
    let fetchCount = 0;
    const sharedFetcher = () => {
      fetchCount += 1;
      return Promise.resolve(7);
    };
    for (const id of ["a", "b", "c"]) {
      registerMetric(
        makeMetric({
          id,
          compute: async (context) => {
            const value = await resolveCachedFetch(context, "shared-table", sharedFetcher);
            return { value, previousValue: null, changePercent: null, trend: "flat", series: [] };
          },
        }),
      );
    }

    const snapshots = await computeVisibleMetrics({ workspaceId: "ws_1", permissions: [], role: "owner", windowKey: "30d" });
    expect(fetchCount).toBe(1);
    expect(snapshots.every((s) => s.result.value === 7)).toBe(true);
  });
});

describe("groupByWeek", () => {
  it("buckets by ISO week (Monday-start), zero-filling weeks with no matching items", () => {
    const window = { start: "2026-07-06T00:00:00.000Z", end: "2026-07-27T00:00:00.000Z" }; // Mon Jul 6 - Mon Jul 27 (3 full weeks)
    const items = [{ date: "2026-07-08T10:00:00.000Z", amount: 100 }, { date: "2026-07-08T14:00:00.000Z", amount: 50 }];
    const series = groupByWeek(items, (i) => i.date, (i) => i.amount, window);
    expect(series).toEqual([
      { label: "2026-07-06", value: 150 },
      { label: "2026-07-13", value: 0 },
      { label: "2026-07-20", value: 0 },
    ]);
  });
});

describe("groupByMonth", () => {
  it("buckets by calendar month, zero-filling months with no matching items", () => {
    const window = { start: "2026-05-01T00:00:00.000Z", end: "2026-08-01T00:00:00.000Z" };
    const items = [{ date: "2026-05-15T00:00:00.000Z", amount: 200 }, { date: "2026-07-01T00:00:00.000Z", amount: 300 }];
    const series = groupByMonth(items, (i) => i.date, (i) => i.amount, window);
    expect(series).toEqual([
      { label: "2026-05", value: 200 },
      { label: "2026-06", value: 0 },
      { label: "2026-07", value: 300 },
    ]);
  });
});

describe("groupByKey", () => {
  it("sums by an arbitrary dimension, sorted descending by value, never zero-filling absent keys", () => {
    const items = [{ client: "a", amount: 100 }, { client: "b", amount: 500 }, { client: "a", amount: 50 }];
    const rows = groupByKey(items, (i) => ({ key: i.client, label: i.client.toUpperCase() }), (i) => i.amount);
    expect(rows).toEqual([
      { key: "b", label: "B", value: 500 },
      { key: "a", label: "A", value: 150 },
    ]);
  });

  it("skips items whose keySelector returns null", () => {
    const items = [{ client: "a" as string | null, amount: 100 }, { client: null, amount: 999 }];
    const rows = groupByKey(items, (i) => (i.client ? { key: i.client, label: i.client } : null), (i) => i.amount);
    expect(rows).toEqual([{ key: "a", label: "a", value: 100 }]);
  });
});
