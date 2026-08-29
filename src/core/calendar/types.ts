import type { CalendarEvent } from "@/types/calendarEvent";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

/**
 * The small, closed set of visual/filter categories the Advanced Calendar
 * (BloomOS Checkpoint — Advanced Calendar phase) classifies every entry
 * into, driving its icon/color and its filter chips. Deliberately closed
 * and small per that checkpoint's own instruction — never invented per
 * source, always one of these three.
 */
export const CALENDAR_EVENT_CATEGORIES = ["event", "task", "deadline"] as const;
export type CalendarEventCategory = (typeof CALENDAR_EVENT_CATEGORIES)[number];

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
 *
 * `context` is optional and threaded through to whatever repository call a
 * source's `fetch` makes — required for a Supabase-backed repository (like
 * `getEvents`) to resolve the caller's real session during a Server Action
 * rather than falling back to an unauthenticated browser client. `core/search`'s
 * `SearchProvider` predates this fix and still omits it; new sources here
 * take the corrected shape from the start.
 */
export interface CalendarEventSource {
  sourceType: string;
  label: string;
  fetch(range: CalendarRange, workspaceId: string, context?: ServerRepositoryContext): Promise<CalendarEvent[]>;
}
