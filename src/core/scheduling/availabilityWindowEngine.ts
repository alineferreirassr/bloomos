import type { WorkingHoursRule, CalendarWindow, Holiday } from "@/types/scheduling";
import { resolveApplicableWorkingHoursRule } from "@/core/scheduling/workingHoursEngine";
import { findHolidayForDate } from "@/core/scheduling/holidayEngine";
import { resolveLocalDateTime } from "@/core/scheduling/timeZoneUtils";

/**
 * v2.0 Checkpoint 27, Step 4 — Availability Window Engine. Combines
 * Working Hours, `CalendarWindow` overrides (both "Availability Windows"
 * and "Blackout Periods" per `types/scheduling.ts`'s doc comment), and
 * Holidays into a single "is this proposed interval actually open"
 * answer. Never duplicates `availabilityEngine.ts` (Checkpoint 26,
 * Worker.status-based) — that engine answers "is a WORKER available";
 * this one answers "is a CALENDAR's time open," with no worker concept
 * at all.
 */

export interface AvailabilityWindowInput {
  calendarId: string;
  workspaceId: string;
  timeZone: string;
  starts_at: string;
  ends_at: string;
  workingHoursRules: WorkingHoursRule[];
  calendarWindows: CalendarWindow[];
  holidays: Holiday[];
}

export interface AvailabilityWindowResult {
  available: boolean;
  reason: string | null;
}

function calendarWindowsFor(windows: CalendarWindow[], calendarId: string): CalendarWindow[] {
  return windows.filter((w) => w.calendar_id === calendarId || w.calendar_id === null);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function fullyCovers(windowStart: string, windowEnd: string, intervalStart: string, intervalEnd: string): boolean {
  return windowStart <= intervalStart && windowEnd >= intervalEnd;
}

function describeBlockingWindow(window: CalendarWindow): string {
  return window.reason ?? `Blocked (${window.type})`;
}

/**
 * Checks whether a proposed `[starts_at, ends_at]` interval is fully
 * open. Resolution order, most authoritative first: an emergency holiday
 * always wins; then any overlapping blocking `CalendarWindow`; then an
 * explicit `"available"` `CalendarWindow` that fully covers the interval
 * (an override that can open a calendar even outside working hours);
 * otherwise falls back to Working Hours. Cross-midnight intervals are
 * out of scope this checkpoint — `starts_at` and `ends_at` must resolve
 * to the same local calendar date.
 */
export function resolveAvailabilityForInterval(input: AvailabilityWindowInput): AvailabilityWindowResult {
  const startLocal = resolveLocalDateTime(input.starts_at, input.timeZone);
  const endLocal = resolveLocalDateTime(input.ends_at, input.timeZone);

  const holiday = findHolidayForDate(input.holidays, input.workspaceId, startLocal.localDate);
  if (holiday !== null && holiday.emergency) return { available: false, reason: `Emergency closure: ${holiday.name}` };

  const relevantWindows = calendarWindowsFor(input.calendarWindows, input.calendarId).filter((w) => overlaps(w.starts_at, w.ends_at, input.starts_at, input.ends_at));
  const blockingWindow = relevantWindows.find((w) => w.type !== "available");
  if (blockingWindow !== undefined) return { available: false, reason: describeBlockingWindow(blockingWindow) };

  if (holiday !== null) return { available: false, reason: `Holiday: ${holiday.name}` };

  const availableOverride = relevantWindows.find((w) => w.type === "available" && fullyCovers(w.starts_at, w.ends_at, input.starts_at, input.ends_at));
  if (availableOverride !== undefined) return { available: true, reason: null };

  if (startLocal.localDate !== endLocal.localDate) return { available: false, reason: "Interval spans more than one calendar day, which this platform does not yet support" };

  const rule = resolveApplicableWorkingHoursRule(input.workingHoursRules, input.calendarId, startLocal.localDate, startLocal.dayOfWeek);
  if (rule === null) return { available: false, reason: "No working hours configured for this day" };
  if (rule.is_closed) return { available: false, reason: "Calendar is closed on this day" };
  if (startLocal.localTime >= rule.starts_time && endLocal.localTime <= rule.ends_time) return { available: true, reason: null };
  return { available: false, reason: "Outside working hours" };
}
