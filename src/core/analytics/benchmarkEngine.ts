import { clockNow } from "@/core/time/clock";
import type { TimeWindow } from "@/types/analytics";
import type { BenchmarkPeriod, BenchmarkResult } from "@/types/businessIntelligence";
import { BENCHMARK_PERIODS } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 11 — Benchmark Center. Generic over any "sum a
 * value within a window" function the caller already has (Revenue, Profit,
 * Events booked, etc.) — this engine only owns resolving the five period
 * windows and assembling the comparison, never the domain arithmetic
 * itself, the same separation `resolveTrendWindow`/`computeVisibleMetrics`
 * already keep between "what window" and "what value".
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveBenchmarkWindow(period: BenchmarkPeriod, now: Date = clockNow()): TimeWindow {
  if (period === "thisMonth") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start: start.toISOString(), end: now.toISOString() };
  }
  if (period === "lastMonth") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === "sameMonthLastYear") {
    const start = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth() + 1, 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const days = period === "rolling30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * DAY_MS);
  return { start: start.toISOString(), end: now.toISOString() };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

/** Computes all five benchmark periods for one metric via the caller-supplied `computeForWindow`, which is expected to already sum/aggregate the caller's own data (e.g. `sumBy(filterInWindow(invoices, ...), ...)`). */
export async function computeBenchmark(label: string, computeForWindow: (window: TimeWindow) => Promise<number> | number, now: Date = clockNow()): Promise<BenchmarkResult> {
  const values = await Promise.all(
    BENCHMARK_PERIODS.map(async (period) => ({ period, value: await computeForWindow(resolveBenchmarkWindow(period, now)) })),
  );

  const thisMonth = values.find((v) => v.period === "thisMonth")?.value ?? 0;
  const lastMonth = values.find((v) => v.period === "lastMonth")?.value ?? 0;
  const sameMonthLastYear = values.find((v) => v.period === "sameMonthLastYear")?.value ?? 0;

  return {
    label,
    values,
    changeVsLastMonthPercent: percentChange(thisMonth, lastMonth),
    changeVsSameMonthLastYearPercent: percentChange(thisMonth, sameMonthLastYear),
  };
}
