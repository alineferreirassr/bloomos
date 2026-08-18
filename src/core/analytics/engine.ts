import { clockNow } from "@/core/time/clock";
import { getLogger } from "@/core/observability/logger";
import { listVisibleMetrics, type ListMetricsForWorkspaceParams } from "@/core/analytics/discovery";
import type { AnalyticsMetricSnapshot, MetricComputeContext, MetricComputeResult, MetricDefinition, MetricSeriesPoint, MetricTrendDirection, TimeWindow, TrendWindowKey } from "@/types/analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Checkpoint 15, Step 5 — Trend Analysis's own closed set of windows,
 * resolved to a real `[start, end)` pair plus the immediately-preceding,
 * equal-length window for period-over-period comparison. `"today"` and
 * `"year"` are calendar-aligned (midnight, Jan 1) the way a human expects
 * "today"/"this year" to mean; `"7d"`/`"30d"`/`"90d"` are rolling windows
 * (exactly N × 24h back from now), matching every other rolling-window
 * call site already in this codebase (`getDashboardMetrics`'s own
 * `oneWeekMs`, `buildUpcomingDeadlines`'s own `windowMs`).
 */
export function resolveTrendWindow(key: TrendWindowKey, now: Date = clockNow()): { window: TimeWindow; previousWindow: TimeWindow } {
  if (key === "today") {
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfYesterday = new Date(startOfToday.getTime() - DAY_MS);
    return {
      window: { start: startOfToday.toISOString(), end: now.toISOString() },
      previousWindow: { start: startOfYesterday.toISOString(), end: startOfToday.toISOString() },
    };
  }

  if (key === "year") {
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const startOfPreviousYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
    return {
      window: { start: startOfYear.toISOString(), end: now.toISOString() },
      previousWindow: { start: startOfPreviousYear.toISOString(), end: startOfYear.toISOString() },
    };
  }

  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const spanMs = days * DAY_MS;
  const start = new Date(now.getTime() - spanMs);
  const previousStart = new Date(now.getTime() - 2 * spanMs);
  return {
    window: { start: start.toISOString(), end: now.toISOString() },
    previousWindow: { start: previousStart.toISOString(), end: start.toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Generic aggregation helpers — Step 2's own "never hardcode calculations
// inside the UI." Every metric `compute()` function is expected to build its
// own `MetricComputeResult` out of these, rather than each hand-rolling its
// own date-window filtering/grouping/comparison arithmetic.
// ---------------------------------------------------------------------------

/**
 * Phase 08 fix — a date-only value ("YYYY-MM-DD", e.g. a payment `transaction_date` or an invoice
 * `due_date` stored as a DATE column) has no time component, so comparing it lexicographically against
 * a full-ISO bound ("YYYY-MM-DDT00:00:00.000Z") sorts it *before* that same day's midnight and wrongly
 * drops it from a window whose start is that midnight — most visibly, "today". Normalize a bare date to
 * the start of its UTC day so it participates in the window by its calendar date. Values already
 * carrying a time ("...T...") are untouched, and inclusive-start / exclusive-end semantics are
 * preserved for every window boundary.
 */
function normalizeWindowValue(iso: string): string {
  return iso.length === 10 ? `${iso}T00:00:00.000Z` : iso;
}

export function isWithinWindow(iso: string, window: TimeWindow): boolean {
  const value = normalizeWindowValue(iso);
  return value >= window.start && value < window.end;
}

export function filterInWindow<T>(items: T[], dateSelector: (item: T) => string, window: TimeWindow): T[] {
  return items.filter((item) => isWithinWindow(dateSelector(item), window));
}

export function sumBy<T>(items: T[], valueSelector: (item: T) => number): number {
  return items.reduce((total, item) => total + valueSelector(item), 0);
}

/** Buckets `items` into one calendar-day (UTC) point per day the window spans, summing `valueSelector` per bucket — chart-ready `MetricSeriesPoint[]`, oldest first. Days with no matching items still appear, at `0`, so a chart never silently skips a gap. */
export function groupByDay<T>(items: T[], dateSelector: (item: T) => string, valueSelector: (item: T) => number, window: TimeWindow): MetricSeriesPoint[] {
  const buckets = new Map<string, number>();
  const start = new Date(window.start);
  const end = new Date(window.end);
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())); cursor < end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    buckets.set(cursor.toISOString().slice(0, 10), 0);
  }
  for (const item of items) {
    const iso = dateSelector(item);
    if (!isWithinWindow(iso, window)) continue;
    const key = iso.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + valueSelector(item));
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

/** Monday of the UTC calendar week containing `date`, at midnight. */
function startOfIsoWeek(date: Date): Date {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const isoDayOfWeek = utcDate.getUTCDay() === 0 ? 7 : utcDate.getUTCDay();
  utcDate.setUTCDate(utcDate.getUTCDate() - (isoDayOfWeek - 1));
  return utcDate;
}

/** v2 Checkpoint 23 — Revenue Analytics' own week bucketing (Step 2's "Revenue by Week"). Same zero-fill/oldest-first contract as `groupByDay`, one point per ISO week (Monday-start) the window spans, labeled by that Monday's date. */
export function groupByWeek<T>(items: T[], dateSelector: (item: T) => string, valueSelector: (item: T) => number, window: TimeWindow): MetricSeriesPoint[] {
  const WEEK_MS = 7 * DAY_MS;
  const buckets = new Map<string, number>();
  const start = startOfIsoWeek(new Date(window.start));
  const end = new Date(window.end);
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + WEEK_MS)) {
    buckets.set(cursor.toISOString().slice(0, 10), 0);
  }
  for (const item of items) {
    const iso = dateSelector(item);
    if (!isWithinWindow(iso, window)) continue;
    const key = startOfIsoWeek(new Date(iso)).toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + valueSelector(item));
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

/** v2 Checkpoint 23 — Revenue Analytics' own month bucketing (Step 2's "Revenue by Month", also the historical input `ForecastEngine` fits against). Labels are `"YYYY-MM"`, zero-filled across every calendar month the window spans. */
export function groupByMonth<T>(items: T[], dateSelector: (item: T) => string, valueSelector: (item: T) => number, window: TimeWindow): MetricSeriesPoint[] {
  const buckets = new Map<string, number>();
  const start = new Date(window.start);
  const end = new Date(window.end);
  for (let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); cursor < end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    buckets.set(cursor.toISOString().slice(0, 7), 0);
  }
  for (const item of items) {
    const iso = dateSelector(item);
    if (!isWithinWindow(iso, window)) continue;
    const key = iso.slice(0, 7);
    buckets.set(key, (buckets.get(key) ?? 0) + valueSelector(item));
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

export interface DimensionBreakdownRow {
  key: string;
  label: string;
  value: number;
}

/**
 * v2 Checkpoint 23 — the generic "Revenue by X" / "Cost by X" grouping
 * `groupByDay`/`groupByWeek`/`groupByMonth` don't cover: bucketing by an
 * arbitrary dimension (Event, Service, Client, Source, Team) rather than
 * time. Unlike the time bucketers, there's no fixed key set to zero-fill —
 * a dimension like "Client" has no natural empty range — so this only
 * returns keys that actually occurred, sorted by value descending (the
 * order every "Revenue by X" table in this checkpoint wants).
 */
export function groupByKey<T>(items: T[], keySelector: (item: T) => { key: string; label: string } | null, valueSelector: (item: T) => number): DimensionBreakdownRow[] {
  const buckets = new Map<string, DimensionBreakdownRow>();
  for (const item of items) {
    const keyed = keySelector(item);
    if (keyed === null) continue;
    const existing = buckets.get(keyed.key);
    const value = valueSelector(item);
    if (existing) existing.value += value;
    else buckets.set(keyed.key, { key: keyed.key, label: keyed.label, value });
  }
  return [...buckets.values()].sort((a, b) => b.value - a.value);
}

/**
 * `previous === null` (no prior-period data exists at all — a
 * point-in-time snapshot metric like Outstanding Balance) and
 * `previous === 0` (a real zero baseline that genuinely grew) are
 * deliberately distinct: only the latter is a real, meaningful trend.
 * Both still report `changePercent: null` rather than a fabricated
 * `Infinity`/`0`, but `previous === null` also reports `trend: "flat"` —
 * never an "up" arrow implying a comparison that doesn't exist.
 */
export function compareTrend(current: number, previous: number | null): { changePercent: number | null; trend: MetricTrendDirection } {
  if (previous === null) return { changePercent: null, trend: "flat" };
  if (previous === 0) return { changePercent: null, trend: current > 0 ? "up" : "flat" };
  const changePercent = ((current - previous) / previous) * 100;
  const trend: MetricTrendDirection = changePercent > 0.5 ? "up" : changePercent < -0.5 ? "down" : "flat";
  return { changePercent, trend };
}

/** The one helper every metric's own `compute()` should return through — bundles a raw `current`/`previous` pair into a full `MetricComputeResult`, including the derived trend. */
export function buildMetricResult(current: number, previous: number | null, series: MetricSeriesPoint[] = []): MetricComputeResult {
  const { changePercent, trend } = compareTrend(current, previous);
  return { value: current, previousValue: previous, changePercent, trend, series };
}

// ---------------------------------------------------------------------------
// Orchestration — computing one or many registered metrics for a real
// request, with the same "never let one failure cascade" discipline
// `dispatchAutomationTrigger`'s own try/catch already established.
// ---------------------------------------------------------------------------

const EMPTY_RESULT: MetricComputeResult = { value: 0, previousValue: null, changePercent: null, trend: "flat", series: [] };

/** Strips `compute` (and every other registry-only field) down to the `Pick<...>` a snapshot is meant to carry — `MetricDefinition` itself is never safe to return from a `"use server"` action, since its `compute` function can't cross the server/client boundary. */
function toMetricSummary(definition: MetricDefinition): AnalyticsMetricSnapshot["metric"] {
  return { id: definition.id, name: definition.name, description: definition.description, category: definition.category, unit: definition.unit, icon: definition.icon };
}

async function computeOne(definition: MetricDefinition, context: MetricComputeContext): Promise<AnalyticsMetricSnapshot> {
  const started = Date.now();
  const metric = toMetricSummary(definition);
  try {
    const result = await definition.compute(context);
    getLogger().info("Metric computed", { workspaceId: context.workspaceId, metricId: definition.id, durationMs: Date.now() - started });
    return { metric, result };
  } catch (error) {
    getLogger().error("Metric computation failed", {
      workspaceId: context.workspaceId,
      metricId: definition.id,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { metric, result: EMPTY_RESULT };
  }
}

export interface ComputeAnalyticsParams extends ListMetricsForWorkspaceParams {
  windowKey: TrendWindowKey;
  now?: Date;
}

/** A metric's own `cachedFetch(key, fetcher)` fallback when no request-scoped cache is present (e.g. a `compute()` invoked standalone in a test) — just calls `fetcher` directly. */
export function resolveCachedFetch<T>(context: MetricComputeContext, key: string, fetcher: () => Promise<T>): Promise<T> {
  return context.cachedFetch ? context.cachedFetch(key, fetcher) : fetcher();
}

/** Every visible metric for one category (or, with `category` omitted, every visible metric registered), computed in parallel for the requested Trend window. */
export async function computeVisibleMetrics(params: ComputeAnalyticsParams): Promise<AnalyticsMetricSnapshot[]> {
  const started = Date.now();
  const definitions = await listVisibleMetrics(params);
  const { window, previousWindow } = resolveTrendWindow(params.windowKey, params.now);

  // Checkpoint 45A — several metrics independently re-fetch the exact same
  // zero-arg base tables (getInvoices(), getEvents(), etc.); this cache is
  // scoped to this one call and shared by every metric's compute() via
  // context.cachedFetch, so the underlying store is read once per table
  // instead of once per metric.
  const requestCache = new Map<string, Promise<unknown>>();
  const cachedFetch = <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
    if (!requestCache.has(key)) requestCache.set(key, fetcher());
    return requestCache.get(key) as Promise<T>;
  };

  const context: MetricComputeContext = { workspaceId: params.workspaceId, window, previousWindow, permissions: params.permissions, role: params.role ?? "staff", cachedFetch };

  const snapshots = await Promise.all(definitions.map((definition) => computeOne(definition, context)));
  getLogger().info("Analytics dashboard computed", {
    workspaceId: params.workspaceId,
    category: params.category ?? "all",
    windowKey: params.windowKey,
    metricCount: snapshots.length,
    durationMs: Date.now() - started,
  });
  return snapshots;
}
