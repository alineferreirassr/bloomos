import { GoogleCalendarApiError } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarEventApiDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleCalendarEventApiOrganizer {
  email?: string;
  displayName?: string;
  self?: boolean;
}

export interface GoogleCalendarEventApiAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
  self?: boolean;
  optional?: boolean;
}

export interface GoogleCalendarEventApiItem {
  id: string;
  iCalUID?: string;
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarEventApiDateTime;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: GoogleCalendarEventApiDateTime;
  end?: GoogleCalendarEventApiDateTime;
  organizer?: GoogleCalendarEventApiOrganizer;
  attendees?: GoogleCalendarEventApiAttendee[];
  htmlLink?: string;
  hangoutLink?: string;
}

export interface GoogleCalendarEventApiPage {
  items: GoogleCalendarEventApiItem[];
  nextPageToken?: string;
}

/**
 * GCAL-04 — the one, minimal REST call this checkpoint's bounded initial
 * event sync needs: `GET /calendars/{calendarId}/events`, one page at a
 * time, always `singleEvents=true` (Google expands recurring series
 * server-side — this domain never builds its own RRULE engine) and
 * always `showDeleted=true` (so a cancelled occurrence/event is
 * representable from the very first sync, not just after a later
 * incremental one). Same standalone-client precedent as
 * `googleCalendarIdentity.ts`/`googleCalendarListApi.ts` (plain `fetch`,
 * reuses `GoogleCalendarApiError` rather than duplicating it) — never
 * reaches into `GoogleCalendarProvider`
 * (`core/integrations/providers/googleCalendar/`), the pre-existing
 * outbound write-capable adapter, which this checkpoint leaves
 * untouched.
 *
 * Maps only the fields GCAL-04 actually persists — organizer/attendees
 * are read narrowly (`email`/`displayName`/`responseStatus`/`self`/
 * `optional`), never Google's full attendee/organizer object (no
 * `comment`, `additionalGuests`, or other provider extensions).
 * `conferenceData` is deliberately never read at all — only the flat
 * `hangoutLink` field, when Google returns one, per this checkpoint's
 * own "do not deeply model conference data" boundary.
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  providerCalendarId: string,
  params: { timeMin: string; timeMax: string; maxResults: number; pageToken?: string },
): Promise<GoogleCalendarEventApiPage> {
  const query = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    maxResults: String(params.maxResults),
    singleEvents: "true",
    showDeleted: "true",
  });
  if (params.pageToken) query.set("pageToken", params.pageToken);

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(providerCalendarId)}/events?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleCalendarApiError(`Google Calendar API error ${response.status}: ${body.slice(0, 200)}`, response.status);
  }
  const data = (await response.json()) as { items?: GoogleCalendarEventApiItem[]; nextPageToken?: string };
  return { items: data.items ?? [], nextPageToken: data.nextPageToken };
}
