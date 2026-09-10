import type { CalendarEventSource } from "@/core/calendar/types";
import type { CalendarEvent } from "@/types/calendarEvent";
import type { GoogleCalendarEvent } from "@/core/integrations/googleCalendarReadonly/types";
import { listActiveCalendarEventsForCaller, type GoogleCalendarCallerScope } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";

const GOOGLE_CALENDAR_EVENT_SOURCE_TYPE = "google_calendar_event";
const INTEGRATIONS_CALENDAR_PERMISSION = "integrations.calendar";

/**
 * Google's own all-day `end_date` is exclusive (the day after the last
 * day the event actually covers) — this calendar's other sources
 * (`eventsCalendarSource`/`taskCalendarSource`) instead set an all-day
 * entry's own `end` to the *same* calendar day as its start (inclusive,
 * one-day-style), so a Google all-day event needs its end date shifted
 * back one day before it's mapped into `CalendarEvent.end`, or it would
 * visually read as spanning one extra day. This never touches the
 * persisted `end_date` itself (`google_calendar_events.end_date` stays
 * Google's own exclusive value, faithfully, per GCAL-04's own migration
 * comment) — only this display-layer mapping adjusts it.
 */
function inclusiveAllDayEndDate(exclusiveEndDate: string): string {
  const [year, month, day] = exclusiveEndDate.split("-").map(Number);
  const inclusive = new Date(year, month - 1, day - 1);
  return `${inclusive.getFullYear()}-${String(inclusive.getMonth() + 1).padStart(2, "0")}-${String(inclusive.getDate()).padStart(2, "0")}`;
}

/**
 * `start_date_time`/`end_date_time` are `timestamptz` columns — Postgres
 * normalizes them to an absolute instant and returns that instant's own
 * UTC representation, not the original per-event UTC-offset string
 * Google sent. So the event's own wall-clock local time can't be read
 * off the stored string directly; it must be recomputed from the
 * absolute instant plus the event's own separately-stored IANA
 * `time_zone`, using `Intl.DateTimeFormat` (a JS built-in — no new
 * dependency) rather than the server's own local timezone (which
 * `Date`'s own string/getters would silently use instead, showing the
 * wrong hour to anyone not colocated with the server).
 */
function formatInstantInTimeZone(instant: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function toLocalDateTimeString(iso: string, timeZone: string | null): string {
  const instant = new Date(iso);
  try {
    return formatInstantInTimeZone(instant, timeZone ?? "UTC");
  } catch {
    // An unrecognized/malformed IANA zone string — fall back to UTC rather than let one bad event break the whole source.
    return formatInstantInTimeZone(instant, "UTC");
  }
}

/**
 * Maps one persisted, already-active (never cancelled — filtered before
 * this is called) Google Calendar event into the Calendar's own
 * source-agnostic shape. `id`/`sourceId` use this row's own internal
 * uuid, never `provider_event_id` — no provider id, and no `sync_token`
 * (which this type doesn't even carry), ever reaches a client component.
 * `href` is deliberately omitted: no internal BloomOS page exists for an
 * external Google event, and every Advanced Calendar view already
 * renders an event with no `href` as a plain, non-interactive row (see
 * `MonthGrid`/`WeekGrid`/`DayTimeline`/`AgendaList`'s own `else`
 * branches) — so a Google event is inert by construction, with no new
 * guard code needed. `description`/`location`/attendees/organizer are
 * deliberately never mapped: `CalendarEvent` has no fields for them, and
 * no existing Calendar view renders them — adding either would be new
 * UI surface this checkpoint doesn't authorize.
 */
function toCalendarEvent(event: GoogleCalendarEvent): CalendarEvent | null {
  const title = event.summary && event.summary.trim().length > 0 ? event.summary : "Untitled event";

  if (event.all_day) {
    if (!event.start_date) return null;
    const endDateInclusive = event.end_date ? inclusiveAllDayEndDate(event.end_date) : event.start_date;
    return {
      id: `${GOOGLE_CALENDAR_EVENT_SOURCE_TYPE}:${event.id}`,
      title,
      start: `${event.start_date}T00:00:00`,
      end: `${endDateInclusive}T23:59:00`,
      allDay: true,
      sourceType: GOOGLE_CALENDAR_EVENT_SOURCE_TYPE,
      sourceId: event.id,
      category: "event",
      timezone: event.time_zone,
    };
  }

  if (!event.start_date_time || !event.end_date_time) return null;
  return {
    id: `${GOOGLE_CALENDAR_EVENT_SOURCE_TYPE}:${event.id}`,
    title,
    start: toLocalDateTimeString(event.start_date_time, event.time_zone),
    end: toLocalDateTimeString(event.end_date_time, event.time_zone),
    allDay: false,
    sourceType: GOOGLE_CALENDAR_EVENT_SOURCE_TYPE,
    sourceId: event.id,
    category: "event",
    timezone: event.time_zone,
  };
}

/**
 * GCAL-06 — the Calendar's third `CalendarEventSource`, surfacing a
 * member's own synced Google Calendar events (GCAL-02–05's persisted
 * `google_calendar_events`) into the existing Advanced Calendar without
 * any view-layer change: `getCalendarEventsAction` already fans out to
 * every registered source (see `defaultRegistrations.ts`).
 *
 * This source never calls the Google API, never handles a token, and
 * never triggers a sync — it is a pure, bounded, ownership-checked read
 * over already-persisted data (`listActiveCalendarEventsForCaller`
 * already filters to active/non-cancelled events from only the caller's
 * own `is_selected` calendars, overlapping the requested range at the
 * database level). Every "why is this empty" case (no session context,
 * missing `integrations.calendar` permission, no connected account, no
 * selected calendars) resolves to a plain empty array — the Advanced
 * Calendar behaves exactly as it does today with zero Google events
 * contributed, never a Google-specific error state, and a genuine
 * failure inside `fetch` itself is already isolated per-source by
 * `getCalendarEventsAction`'s own `.catch(() => [])` (unchanged, no new
 * code needed there).
 *
 * `context` is required here even though the interface marks it
 * optional (unlike the Events/Tasks sources, which are workspace-scoped
 * only): Google Calendar accounts/calendars/events are *member*-owned,
 * so this source needs the caller's own auth user id
 * (`context.session.user.id`, matching every other `google_calendar_*`
 * read/write's own `GoogleCalendarCallerScope` convention exactly — see
 * `googleCalendarAccountActions.ts`) to know whose calendar to read. In
 * a data mode with no server session context (e.g. mock preview), there
 * is no member to scope by, so this source safely contributes nothing.
 *
 * Permission gating composes two independent checks, both already
 * enforced by the time this runs: `events.view` gates the whole
 * `/calendar` route (`RouteGuard`) and `getCalendarEventsAction` itself;
 * `integrations.calendar` — the same permission every other Google
 * Calendar Readonly action already requires — is checked here, since a
 * source's own `fetch` has no other way to see the caller's permission
 * set. A member who can see the Calendar but was never granted
 * `integrations.calendar` still sees every other source's events
 * normally; only Google's own row is withheld.
 */
export function createGoogleCalendarEventSource(): CalendarEventSource {
  return {
    sourceType: GOOGLE_CALENDAR_EVENT_SOURCE_TYPE,
    label: "Google Calendar",
    async fetch(range, workspaceId, context) {
      if (!context) return [];
      if (!context.session.permissions.includes(INTEGRATIONS_CALENDAR_PERMISSION)) return [];

      const caller: GoogleCalendarCallerScope = { workspaceId, memberId: context.session.user.id };
      const events = await listActiveCalendarEventsForCaller({ from: range.start.toISOString(), to: range.end.toISOString() }, caller);

      const mapped: CalendarEvent[] = [];
      for (const event of events) {
        const calendarEvent = toCalendarEvent(event);
        if (calendarEvent) mapped.push(calendarEvent);
      }
      return mapped;
    },
  };
}
