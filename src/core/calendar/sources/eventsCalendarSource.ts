import type { CalendarEventSource, CalendarRange } from "@/core/calendar/types";
import type { CalendarEvent } from "@/types/calendarEvent";
import type { Event } from "@/types/event";
import { getEvents } from "@/lib/data";
import { EVENT_STATUS_LABELS } from "@/core/enums/eventStatus";

function eventDateWithinRange(event: Event, range: CalendarRange): boolean {
  if (!event.event_date) return false;
  const [year, month, day] = event.event_date.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date >= range.start && date < range.end;
}

/** Combines `event_date` with `start_time`/`end_time` (plain `"HH:MM"` text, see `types/event.ts`) into the ISO-ish local datetime strings `CalendarEvent` expects; falls back to an all-day entry when no time is recorded. */
function toCalendarEvent(event: Event): CalendarEvent {
  const allDay = !event.start_time;
  const startTime = event.start_time ?? "00:00";
  const endTime = event.end_time ?? event.start_time ?? "23:59";
  return {
    id: `event:${event.id}`,
    title: event.title,
    start: `${event.event_date}T${startTime}:00`,
    end: `${event.event_date}T${endTime}:00`,
    allDay,
    sourceType: "event",
    sourceId: event.id,
    href: `/events/${event.id}`,
    category: "event",
    assignedName: event.assigned_owner,
    statusLabel: EVENT_STATUS_LABELS[event.status],
    latitude: event.latitude,
    longitude: event.longitude,
    timezone: event.timezone,
  };
}

/**
 * Advanced Calendar phase — the Calendar's primary `CalendarEventSource`,
 * mapping the real, persisted Events domain into the calendar's generic
 * shape. The Calendar never queries `getEvents` a second, independent way
 * — this is the one place that translation happens, matching the
 * "Calendar is a view over Events, not a second source of truth"
 * instruction this phase was built under.
 */
export function createEventsCalendarSource(): CalendarEventSource {
  return {
    sourceType: "event",
    label: "Events",
    async fetch(range, workspaceId, context) {
      const events = await getEvents(undefined, context);
      return events
        .filter((event) => event.workspace_id === workspaceId)
        .filter((event) => event.archived_at === null && event.cancelled_at === null)
        .filter((event) => eventDateWithinRange(event, range))
        .map(toCalendarEvent);
    },
  };
}
