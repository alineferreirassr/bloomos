import { registerCalendarEventSource, getCalendarEventSources } from "@/core/calendar/registry";
import { createEventsCalendarSource } from "@/core/calendar/sources/eventsCalendarSource";
import { createTaskCalendarSource } from "@/core/calendar/sources/taskCalendarSource";

/**
 * Advanced Calendar phase — registers the Calendar's two real
 * `CalendarEventSource`s (Events, Event checklist due-dates). Idempotent
 * via `getCalendarEventSources().length` so calling this at the top of
 * every calendar Server Action module (each a fresh import in its own
 * request in most runtimes, but not guaranteed) never double-registers.
 */
export function registerDefaultCalendarEventSources(): void {
  if (getCalendarEventSources().length > 0) return;
  registerCalendarEventSource(createEventsCalendarSource());
  registerCalendarEventSource(createTaskCalendarSource());
}
