import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseCalendarStore from "@/lib/data/core/integrations/googleCalendarReadonly/supabaseCalendarStore";
import type { GoogleCalendar } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-03 — the Google Calendar (read-only) calendar-list store, mirroring `accountStore.ts`'s exact shape. No ownership validation here — `googleCalendarAccountManager.ts`'s job. */
let calendars: GoogleCalendar[] = [];

export function resetGoogleCalendarStore(): void {
  calendars = [];
}

export function generateGoogleCalendarId(): string {
  return generateId("google-calendar");
}

async function mockInsertCalendar(calendar: GoogleCalendar): Promise<GoogleCalendar> {
  calendars = [...calendars, calendar];
  return calendar;
}

async function mockGetCalendarById(id: string): Promise<GoogleCalendar | null> {
  return calendars.find((calendar) => calendar.id === id) ?? null;
}

async function mockGetCalendarByProviderId(accountId: string, providerCalendarId: string): Promise<GoogleCalendar | null> {
  return calendars.find((calendar) => calendar.account_id === accountId && calendar.provider_calendar_id === providerCalendarId) ?? null;
}

async function mockListCalendarsForAccount(accountId: string): Promise<GoogleCalendar[]> {
  return calendars.filter((calendar) => calendar.account_id === accountId);
}

async function mockUpdateCalendar(id: string, patch: Partial<GoogleCalendar>): Promise<GoogleCalendar | null> {
  const existing = await mockGetCalendarById(id);
  if (!existing) return null;
  const updated: GoogleCalendar = { ...existing, ...patch, updated_at: nowIso() };
  calendars = calendars.map((calendar) => (calendar.id === id ? updated : calendar));
  return updated;
}

export function insertCalendar(calendar: GoogleCalendar): Promise<GoogleCalendar> {
  return selectRepository({ mock: mockInsertCalendar, supabase: supabaseCalendarStore.insertCalendar })(calendar);
}

export function getCalendarById(id: string): Promise<GoogleCalendar | null> {
  return selectRepository({ mock: mockGetCalendarById, supabase: supabaseCalendarStore.getCalendarById })(id);
}

export function getCalendarByProviderId(accountId: string, providerCalendarId: string): Promise<GoogleCalendar | null> {
  return selectRepository({ mock: mockGetCalendarByProviderId, supabase: supabaseCalendarStore.getCalendarByProviderId })(accountId, providerCalendarId);
}

export function listCalendarsForAccount(accountId: string): Promise<GoogleCalendar[]> {
  return selectRepository({ mock: mockListCalendarsForAccount, supabase: supabaseCalendarStore.listCalendarsForAccount })(accountId);
}

export function updateCalendar(id: string, patch: Partial<GoogleCalendar>): Promise<GoogleCalendar | null> {
  return selectRepository({ mock: mockUpdateCalendar, supabase: supabaseCalendarStore.updateCalendar })(id, patch);
}
