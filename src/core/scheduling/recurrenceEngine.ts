import type { RecurrenceRule } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 9 — Recurrence Engine. Pure calendar-date
 * generation from a `RecurrenceRule` — no timezone arithmetic (dates are
 * plain `YYYY-MM-DD` strings, resolved via `Date.UTC` purely as a
 * calendar calculator, never as a real instant). This engine only ever
 * produces candidate DATES; turning a date into a real `Appointment`
 * occurrence (applying the seed's time-of-day, duration, and running
 * conflict/capacity checks) is the caller's job — never duplicated here.
 */

/** Bounds how many occurrences a single call will ever walk through — roughly 5.5 years of daily occurrences. A misconfigured rule (e.g. no `end_date` and no `occurrence_count`) can't spin this engine forever. */
export const MAX_OCCURRENCES_SAFETY_CAP = 2000;

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function daysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `week` is 1-4 for the nth occurrence in the month, or `-1` for the last. Returns `null` only if `week` is out of that range. */
function resolveNthWeekdayDate(year: number, monthIndex: number, week: number, weekday: number): Date | null {
  if (week === -1) {
    const lastDay = daysInMonthUTC(year, monthIndex);
    for (let day = lastDay; day > lastDay - 7; day--) {
      const candidate = new Date(Date.UTC(year, monthIndex, day));
      if (candidate.getUTCDay() === weekday) return candidate;
    }
    return null;
  }
  if (week < 1 || week > 4) return null;
  let matchCount = 0;
  for (let day = 1; day <= daysInMonthUTC(year, monthIndex); day++) {
    const candidate = new Date(Date.UTC(year, monthIndex, day));
    if (candidate.getUTCDay() === weekday) {
      matchCount++;
      if (matchCount === week) return candidate;
    }
  }
  return null;
}

interface GenerationBounds {
  rule: RecurrenceRule;
  rangeStart: string;
  rangeEnd: string;
}

/** `true` once no further occurrence — at this index, at or after this date — could ever land inside the query range or the rule's own bounds. */
function isExhausted(dateStr: string, index: number, bounds: GenerationBounds): boolean {
  if (dateStr > bounds.rangeEnd) return true;
  if (bounds.rule.end_date !== null && dateStr > bounds.rule.end_date) return true;
  if (bounds.rule.occurrence_count !== null && index >= bounds.rule.occurrence_count) return true;
  return index >= MAX_OCCURRENCES_SAFETY_CAP;
}

function collect(dateStr: string, index: number, bounds: GenerationBounds, exceptions: Set<string>, results: string[]): void {
  if (bounds.rule.occurrence_count !== null && index >= bounds.rule.occurrence_count) return;
  if (bounds.rule.end_date !== null && dateStr > bounds.rule.end_date) return;
  if (dateStr >= bounds.rangeStart && dateStr <= bounds.rangeEnd && !exceptions.has(dateStr)) results.push(dateStr);
}

function generateDaily(seed: Date, bounds: GenerationBounds, exceptions: Set<string>): string[] {
  const results: string[] = [];
  let current = seed;
  let index = 0;
  while (!isExhausted(formatDate(current), index, bounds)) {
    collect(formatDate(current), index, bounds, exceptions, results);
    current = addDaysUTC(current, bounds.rule.interval);
    index++;
  }
  return results;
}

/** Walks week-by-week from the seed's own week, only processing weeks that land on an `interval` boundary, expanding each into its matched `days_of_week`. */
function generateWeekly(seed: Date, bounds: GenerationBounds, exceptions: Set<string>): string[] {
  const results: string[] = [];
  const days = (bounds.rule.days_of_week ?? [seed.getUTCDay()]).slice().sort((a, b) => a - b);
  const weekStart = addDaysUTC(seed, -seed.getUTCDay());
  let index = 0;
  for (let weekOffset = 0; ; weekOffset += bounds.rule.interval) {
    const thisWeekStart = addDaysUTC(weekStart, weekOffset * 7);
    if (formatDate(thisWeekStart) > bounds.rangeEnd || index >= MAX_OCCURRENCES_SAFETY_CAP) break;
    let anyRemaining = false;
    for (const weekday of days) {
      const candidate = addDaysUTC(thisWeekStart, weekday);
      if (candidate < seed) continue;
      const dateStr = formatDate(candidate);
      if (isExhausted(dateStr, index, bounds)) continue;
      collect(dateStr, index, bounds, exceptions, results);
      index++;
      anyRemaining = true;
    }
    if (bounds.rule.end_date !== null && formatDate(thisWeekStart) > bounds.rule.end_date) break;
    if (bounds.rule.occurrence_count !== null && index >= bounds.rule.occurrence_count) break;
    if (!anyRemaining && formatDate(thisWeekStart) > bounds.rangeEnd) break;
  }
  return results;
}

function generateMonthly(seed: Date, bounds: GenerationBounds, exceptions: Set<string>): string[] {
  const results: string[] = [];
  const seedYear = seed.getUTCFullYear();
  const seedMonth = seed.getUTCMonth();
  let index = 0;
  for (let monthOffset = 0; ; monthOffset += bounds.rule.interval) {
    const totalMonths = seedMonth + monthOffset;
    const year = seedYear + Math.floor(totalMonths / 12);
    const monthIndex = totalMonths % 12;

    let candidate: Date | null;
    if (bounds.rule.nth_weekday !== null) {
      candidate = resolveNthWeekdayDate(year, monthIndex, bounds.rule.nth_weekday.week, bounds.rule.nth_weekday.weekday);
    } else {
      const day = Math.min(bounds.rule.day_of_month ?? seed.getUTCDate(), daysInMonthUTC(year, monthIndex));
      candidate = new Date(Date.UTC(year, monthIndex, day));
    }
    if (candidate === null || candidate < seed) {
      if (formatDate(new Date(Date.UTC(year, monthIndex, 1))) > bounds.rangeEnd || index >= MAX_OCCURRENCES_SAFETY_CAP) break;
      continue;
    }

    const dateStr = formatDate(candidate);
    if (isExhausted(dateStr, index, bounds)) break;
    collect(dateStr, index, bounds, exceptions, results);
    index++;
  }
  return results;
}

function generateYearly(seed: Date, bounds: GenerationBounds, exceptions: Set<string>): string[] {
  const results: string[] = [];
  const seedMonth = seed.getUTCMonth();
  const seedDay = seed.getUTCDate();
  let index = 0;
  for (let yearOffset = 0; ; yearOffset += bounds.rule.interval) {
    const year = seed.getUTCFullYear() + yearOffset;
    const day = Math.min(seedDay, daysInMonthUTC(year, seedMonth));
    const candidate = new Date(Date.UTC(year, seedMonth, day));
    const dateStr = formatDate(candidate);
    if (isExhausted(dateStr, index, bounds)) break;
    collect(dateStr, index, bounds, exceptions, results);
    index++;
  }
  return results;
}

/**
 * Generates every occurrence date within `[rangeStart, rangeEnd]` that
 * this rule produces, given `seedDate` — the calendar date of the
 * appointment's first, defining occurrence. Occurrence numbering (for
 * `occurrence_count`) always starts counting from `seedDate`, even when
 * `rangeStart` is later — a rule capped at 5 occurrences is still capped
 * at 5 total, not 5 within whatever window happens to be queried.
 */
export function generateOccurrenceDates(rule: RecurrenceRule, seedDate: string, rangeStart: string, rangeEnd: string): string[] {
  const seed = parseDate(seedDate);
  const exceptions = new Set(rule.exception_dates);
  const bounds: GenerationBounds = { rule, rangeStart, rangeEnd };

  switch (rule.frequency) {
    case "daily":
      return generateDaily(seed, bounds, exceptions);
    case "weekly":
      return generateWeekly(seed, bounds, exceptions);
    case "monthly":
      return generateMonthly(seed, bounds, exceptions);
    case "yearly":
      return generateYearly(seed, bounds, exceptions);
  }
}

/** Whether `candidateDate` is itself a live occurrence of this rule (not excluded), regardless of any range — used by the Conflict Engine to check a single date rather than enumerate a whole range. */
export function isOccurrenceDate(rule: RecurrenceRule, seedDate: string, candidateDate: string): boolean {
  if (candidateDate < seedDate) return false;
  return generateOccurrenceDates(rule, seedDate, candidateDate, candidateDate).length > 0;
}
