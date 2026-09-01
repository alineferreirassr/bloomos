import type { CalendarRange, CalendarView } from "@/core/calendar/types";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  day.setDate(day.getDate() - day.getDay());
  return day;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Agenda is a rolling forward-looking operational window, not a calendar-unit like month/week/day — 14 days keeps it a genuinely scannable list rather than a long undifferentiated scroll. */
const AGENDA_WINDOW_DAYS = 14;

/** The `[start, end)` range a view covers for a given anchor date. Week starts on Sunday — no ISO-week/locale handling yet, matching "no scheduling logic" scope. */
export function getRangeForView(date: Date, view: CalendarView): CalendarRange {
  if (view === "day") {
    const start = startOfDay(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (view === "week") {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (view === "agenda") {
    const start = startOfDay(date);
    const end = new Date(start);
    end.setDate(end.getDate() + AGENDA_WINDOW_DAYS);
    return { start, end };
  }

  const start = startOfMonth(date);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return { start, end };
}

/** Moves the anchor date forward by exactly one unit of `view` — a month advances by calendar month (so it lands on the 1st regardless of today's day-of-month), a week/day/agenda by a fixed 7/1/14-day offset. */
export function goToNext(date: Date, view: CalendarView): Date {
  if (view === "day") return addDays(date, 1);
  if (view === "week") return addDays(date, 7);
  if (view === "agenda") return addDays(date, AGENDA_WINDOW_DAYS);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function goToPrevious(date: Date, view: CalendarView): Date {
  if (view === "day") return addDays(date, -1);
  if (view === "week") return addDays(date, -7);
  if (view === "agenda") return addDays(date, -AGENDA_WINDOW_DAYS);
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function goToToday(): Date {
  return new Date();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
