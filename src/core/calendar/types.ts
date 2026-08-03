import type { CalendarEvent } from "@/types/calendarEvent";

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/** `end` is exclusive — "the range covers [start, end)" — avoiding millisecond-boundary edge cases a "last moment of the day" value would invite. */
export interface CalendarRange {
  start: Date;
  end: Date;
}

/**
 * Dependency inversion for what shows up on the calendar, the same shape
 * `core/search`'s `SearchProvider` uses for what's searchable: a source
 * (Events today; Team shifts, Purchases deliveries, etc. later) registers
 * itself once and answers "what happened in this range for this
 * Workspace" — the calendar UI never queries a specific module's
 * repository directly.
 */
export interface CalendarEventSource {
  sourceType: string;
  label: string;
  fetch(range: CalendarRange, workspaceId: string): Promise<CalendarEvent[]>;
}
