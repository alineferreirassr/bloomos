import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseCalendarEventStore from "@/lib/data/core/integrations/googleCalendarReadonly/supabaseCalendarEventStore";
import type { GoogleCalendarEvent } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-04 — the Google Calendar (read-only) event store, mirroring `calendarStore.ts`'s exact shape. No ownership validation here — `googleCalendarAccountManager.ts`'s job. */
let events: GoogleCalendarEvent[] = [];

export function resetGoogleCalendarEventStore(): void {
  events = [];
}

export function generateGoogleCalendarEventId(): string {
  return generateId("google-calendar-event");
}

async function mockInsertEvent(event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
  events = [...events, event];
  return event;
}

async function mockGetEventById(id: string): Promise<GoogleCalendarEvent | null> {
  return events.find((event) => event.id === id) ?? null;
}

async function mockGetEventByProviderId(calendarId: string, providerEventId: string): Promise<GoogleCalendarEvent | null> {
  return events.find((event) => event.calendar_id === calendarId && event.provider_event_id === providerEventId) ?? null;
}

async function mockListEventsForCalendar(calendarId: string): Promise<GoogleCalendarEvent[]> {
  return events.filter((event) => event.calendar_id === calendarId);
}

/** GCAL-06 — bounded, active-only overlap read for the Calendar display source. `all_day`/timed events compare against `fromIso`/`toIso` differently (see `supabaseCalendarEventStore.ts`'s own doc comment for why a real `Date` comparison is required here rather than raw string comparison). */
async function mockListActiveEventsForCalendarInRange(calendarId: string, fromIso: string, toIso: string): Promise<GoogleCalendarEvent[]> {
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);
  const from = new Date(fromIso);
  const to = new Date(toIso);
  return events.filter((event) => {
    if (event.calendar_id !== calendarId || event.cancelled_at !== null) return false;
    if (event.all_day) {
      if (!event.start_date || !event.end_date) return false;
      return event.start_date < toDate && event.end_date > fromDate;
    }
    if (!event.start_date_time || !event.end_date_time) return false;
    return new Date(event.start_date_time) < to && new Date(event.end_date_time) > from;
  });
}

async function mockUpdateEvent(id: string, patch: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
  const existing = await mockGetEventById(id);
  if (!existing) return null;
  const updated: GoogleCalendarEvent = { ...existing, ...patch, updated_at: nowIso() };
  events = events.map((event) => (event.id === id ? updated : event));
  return updated;
}

export function insertEvent(event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
  return selectRepository({ mock: mockInsertEvent, supabase: supabaseCalendarEventStore.insertEvent })(event);
}

export function getEventById(id: string): Promise<GoogleCalendarEvent | null> {
  return selectRepository({ mock: mockGetEventById, supabase: supabaseCalendarEventStore.getEventById })(id);
}

export function getEventByProviderId(calendarId: string, providerEventId: string): Promise<GoogleCalendarEvent | null> {
  return selectRepository({ mock: mockGetEventByProviderId, supabase: supabaseCalendarEventStore.getEventByProviderId })(calendarId, providerEventId);
}

export function listEventsForCalendar(calendarId: string): Promise<GoogleCalendarEvent[]> {
  return selectRepository({ mock: mockListEventsForCalendar, supabase: supabaseCalendarEventStore.listEventsForCalendar })(calendarId);
}

export function listActiveEventsForCalendarInRange(calendarId: string, fromIso: string, toIso: string): Promise<GoogleCalendarEvent[]> {
  return selectRepository({ mock: mockListActiveEventsForCalendarInRange, supabase: supabaseCalendarEventStore.listActiveEventsForCalendarInRange })(calendarId, fromIso, toIso);
}

export function updateEvent(id: string, patch: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
  return selectRepository({ mock: mockUpdateEvent, supabase: supabaseCalendarEventStore.updateEvent })(id, patch);
}
