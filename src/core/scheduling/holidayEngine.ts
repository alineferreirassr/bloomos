import type { Holiday } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 11 — Holiday Engine. Pure lookups over an
 * already-fetched `Holiday[]` — never touches `holidaysStore.ts`
 * directly, same discipline as every other engine in this domain.
 */

/** A `recurring` holiday matches on month/day only (`date.slice(5)` = `"MM-DD"`); a non-recurring one matches the exact date. */
export function findHolidayForDate(holidays: Holiday[], workspaceId: string, localDate: string): Holiday | null {
  const monthDay = localDate.slice(5);
  return (
    holidays.find((h) => {
      if (h.workspace_id !== workspaceId) return false;
      return h.recurring ? h.date.slice(5) === monthDay : h.date === localDate;
    }) ?? null
  );
}

export function isHoliday(holidays: Holiday[], workspaceId: string, localDate: string): boolean {
  return findHolidayForDate(holidays, workspaceId, localDate) !== null;
}

/** An emergency closure (e.g. weather) always blocks scheduling regardless of any working-hours rule, unlike a routine holiday which callers may choose to allow overrides for. */
export function isEmergencyClosure(holidays: Holiday[], workspaceId: string, localDate: string): boolean {
  const holiday = findHolidayForDate(holidays, workspaceId, localDate);
  return holiday !== null && holiday.emergency;
}

export interface HolidayOccurrence {
  holiday: Holiday;
  /** The actual date this occurrence falls on within the queried range — for a `recurring` holiday this is the matched year, not necessarily `holiday.date`'s original stored year. */
  date: string;
}

/** Expands each `recurring` holiday into one occurrence per year the range spans, since a Calendar Dashboard viewing e.g. 2027 needs the 2027 occurrence, not the year the holiday was first created in. */
export function listHolidaysInRange(holidays: Holiday[], workspaceId: string, rangeStart: string, rangeEnd: string): HolidayOccurrence[] {
  const occurrences: HolidayOccurrence[] = [];
  for (const holiday of holidays) {
    if (holiday.workspace_id !== workspaceId) continue;
    if (!holiday.recurring) {
      if (holiday.date >= rangeStart && holiday.date <= rangeEnd) occurrences.push({ holiday, date: holiday.date });
      continue;
    }
    const monthDay = holiday.date.slice(5);
    let cursorYear = Number(rangeStart.slice(0, 4));
    const endYear = Number(rangeEnd.slice(0, 4));
    while (cursorYear <= endYear) {
      const candidate = `${cursorYear}-${monthDay}`;
      if (candidate >= rangeStart && candidate <= rangeEnd) occurrences.push({ holiday, date: candidate });
      cursorYear++;
    }
  }
  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}
