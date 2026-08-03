import { clockNow } from "@/core/time/clock";
import { resolveTrendWindow } from "@/core/analytics/engine";
import type { TimeWindow, TrendWindowKey } from "@/types/analytics";
import type { ReportComparisonMode, ReportComparisonResult, ReportPeriod, ReportPeriodKey } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42, Step 5 — Period resolution + Comparison Engine.
 * Pure and deterministic. `"today"`/`"7d"`/`"30d"`/`"90d"`/`"year"` reuse
 * `core/analytics/engine.ts`'s own `resolveTrendWindow()` (Checkpoint 15)
 * directly — never a second rolling-window implementation; `"month"`/
 * `"quarter"` add the two calendar-aligned windows that engine doesn't
 * have, and `"custom"` passes the caller's own window through unchanged.
 */

const ROLLING_KEYS = new Set<ReportPeriodKey>(["today", "7d", "30d", "90d", "year"]);

function startOfQuarter(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

export function resolveReportWindow(periodKey: ReportPeriodKey, customWindow: TimeWindow | null, now: Date = clockNow()): TimeWindow {
  if (periodKey === "custom") {
    if (customWindow) return customWindow;
    return { start: now.toISOString(), end: now.toISOString() };
  }
  if (ROLLING_KEYS.has(periodKey)) return resolveTrendWindow(periodKey as TrendWindowKey, now).window;
  if (periodKey === "month") return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), end: now.toISOString() };
  return { start: startOfQuarter(now).toISOString(), end: now.toISOString() };
}

export function resolveReportPeriod(periodKey: ReportPeriodKey, customWindow: TimeWindow | null, now: Date = clockNow()): ReportPeriod {
  return { key: periodKey, window: resolveReportWindow(periodKey, customWindow, now) };
}

function shiftWindow(window: TimeWindow, shiftedStart: Date, shiftedEnd: Date): TimeWindow {
  return { start: shiftedStart.toISOString(), end: shiftedEnd.toISOString() };
}

export function buildReportComparison(currentWindow: TimeWindow, mode: ReportComparisonMode, customComparisonWindow: TimeWindow | null = null): ReportComparisonResult {
  const start = new Date(currentWindow.start);
  const end = new Date(currentWindow.end);

  if (mode === "none") {
    return { mode, currentWindow, comparisonWindow: null, comparable: false, missingPeriodReason: null };
  }

  if (mode === "custom") {
    if (!customComparisonWindow) return { mode, currentWindow, comparisonWindow: null, comparable: false, missingPeriodReason: "No custom comparison period was specified." };
    return { mode, currentWindow, comparisonWindow: customComparisonWindow, comparable: true, missingPeriodReason: null };
  }

  if (mode === "previous_period") {
    const spanMs = end.getTime() - start.getTime();
    return { mode, currentWindow, comparisonWindow: shiftWindow(currentWindow, new Date(start.getTime() - spanMs), start), comparable: true, missingPeriodReason: null };
  }

  if (mode === "week_over_week") {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    return { mode, currentWindow, comparisonWindow: shiftWindow(currentWindow, new Date(start.getTime() - WEEK_MS), new Date(end.getTime() - WEEK_MS)), comparable: true, missingPeriodReason: null };
  }

  if (mode === "month_over_month") {
    const shiftedStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
    const shiftedEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds()));
    return { mode, currentWindow, comparisonWindow: shiftWindow(currentWindow, shiftedStart, shiftedEnd), comparable: true, missingPeriodReason: null };
  }

  // year_over_year
  const shiftedStart = new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds()));
  const shiftedEnd = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds()));
  return { mode, currentWindow, comparisonWindow: shiftWindow(currentWindow, shiftedStart, shiftedEnd), comparable: true, missingPeriodReason: null };
}
