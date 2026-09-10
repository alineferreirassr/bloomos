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

export function updateEvent(id: string, patch: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
  return selectRepository({ mock: mockUpdateEvent, supabase: supabaseCalendarEventStore.updateEvent })(id, patch);
}
