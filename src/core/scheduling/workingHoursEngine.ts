import type { WorkingHoursRule, WorkingHoursKind } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 3 — Working Hours Engine. Same "no timezone
 * arithmetic" discipline as `availabilityEngine.ts`: a caller resolves a
 * timestamp to a local calendar date (`YYYY-MM-DD`), weekday (0-6), and
 * local time (`HH:mm`) in the rule's own `time_zone` before calling in —
 * this engine only ever compares those already-resolved strings/numbers.
 */

/**
 * Precedence when multiple rules could apply to the same day, lowest to
 * highest. A specific-date rule always outranks a day-of-week rule
 * regardless of kind (see `resolveApplicableWorkingHoursRule`); this
 * order only breaks ties among rules at the same specificity.
 */
const WORKING_HOURS_KIND_PRIORITY: readonly WorkingHoursKind[] = ["regular", "weekend", "seasonal", "custom", "holiday", "temporary_override"];

function kindPriority(kind: WorkingHoursKind): number {
  return WORKING_HOURS_KIND_PRIORITY.indexOf(kind);
}

function highestPriority(rules: WorkingHoursRule[]): WorkingHoursRule | null {
  if (rules.length === 0) return null;
  return [...rules].sort((a, b) => kindPriority(b.kind) - kindPriority(a.kind))[0];
}

/**
 * Resolves the single rule that governs a given local date, applying the
 * "most specific wins" rule: a `specific_date` match always beats a
 * `day_of_week` match, then kind priority breaks any remaining tie.
 */
export function resolveApplicableWorkingHoursRule(rules: WorkingHoursRule[], calendarId: string, localDate: string, dayOfWeek: number): WorkingHoursRule | null {
  const calendarRules = rules.filter((r) => r.calendar_id === calendarId);
  const dateMatches = calendarRules.filter((r) => r.specific_date === localDate);
  if (dateMatches.length > 0) return highestPriority(dateMatches);

  const weekdayMatches = calendarRules.filter((r) => r.specific_date === null && r.day_of_week === dayOfWeek);
  return highestPriority(weekdayMatches);
}

export interface WorkingHoursResolution {
  isOpen: boolean;
  rule: WorkingHoursRule | null;
}

/** No matching rule at all resolves to closed — an unconfigured calendar never silently accepts bookings. */
export function isWithinWorkingHours(rules: WorkingHoursRule[], calendarId: string, localDate: string, dayOfWeek: number, localTime: string): WorkingHoursResolution {
  const rule = resolveApplicableWorkingHoursRule(rules, calendarId, localDate, dayOfWeek);
  if (rule === null) return { isOpen: false, rule: null };
  if (rule.is_closed) return { isOpen: false, rule };
  const isOpen = localTime >= rule.starts_time && localTime < rule.ends_time;
  return { isOpen, rule };
}
