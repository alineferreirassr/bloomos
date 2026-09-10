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
  /** Only ever present on the true final page of a listing (Google never returns this alongside `nextPageToken`) — see `listGoogleCalendarEvents`'s own doc comment for how GCAL-05 uses this to gate cursor persistence. */
  nextSyncToken?: string;
}

/**
 * GCAL-04's bounded, time-windowed request (`timeMin`/`timeMax`) — the
 * only mode that can establish a calendar's very first `sync_token`,
 * since Google only issues one from a listing it considers "complete."
 */
export interface ListGoogleCalendarEventsFullParams {
  timeMin: string;
  timeMax: string;
  maxResults: number;
  pageToken?: string;
}

/**
 * GCAL-05 — Google's own delta-since-token request. `syncToken` is
 * mutually exclusive with `timeMin`/`timeMax`/`updatedMin` at Google's
 * REST layer (a combined request is rejected) — the two-variant union
 * below enforces that at the type level, and `listGoogleCalendarEvents`
 * builds the query from whichever variant it's given, never both.
 */
export interface ListGoogleCalendarEventsIncrementalParams {
  syncToken: string;
  maxResults: number;
  pageToken?: string;
}

export type ListGoogleCalendarEventsParams = ListGoogleCalendarEventsFullParams | ListGoogleCalendarEventsIncrementalParams;

function isIncrementalParams(params: ListGoogleCalendarEventsParams): params is ListGoogleCalendarEventsIncrementalParams {
  return "syncToken" in params;
}

/**
 * GCAL-04/GCAL-05 — the one canonical REST call this domain's event sync
 * needs: `GET /calendars/{calendarId}/events`, one page at a time,
 * always `singleEvents=true` (Google expands recurring series
 * server-side — this domain never builds its own RRULE engine) and
 * always `showDeleted=true` (so a cancelled occurrence/event is
 * representable in either mode). Same standalone-client precedent as
 * `googleCalendarIdentity.ts`/`googleCalendarListApi.ts` (plain `fetch`,
 * reuses `GoogleCalendarApiError` rather than duplicating it) — never
 * reaches into `GoogleCalendarProvider`
 * (`core/integrations/providers/googleCalendar/`), the pre-existing
 * outbound write-capable adapter, which this checkpoint leaves
 * untouched.
 *
 * One request builder expresses both of Google's own listing modes
 * rather than two near-duplicate functions: a bounded full/initial
 * listing (`timeMin`/`timeMax`) and an incremental delta listing
 * (`syncToken`) — the two are mutually exclusive per Google's own REST
 * contract, enforced here by only ever setting one of the two query-
 * param groups, never both, depending on which `params` variant was
 * given.
 *
 * Maps only the fields this domain actually persists — organizer/
 * attendees are read narrowly (`email`/`displayName`/`responseStatus`/
 * `self`/`optional`), never Google's full attendee/organizer object (no
 * `comment`, `additionalGuests`, or other provider extensions).
 * `conferenceData` is deliberately never read at all — only the flat
 * `hangoutLink` field, when Google returns one, per this checkpoint's
 * own "do not deeply model conference data" boundary.
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  providerCalendarId: string,
  params: ListGoogleCalendarEventsParams,
): Promise<GoogleCalendarEventApiPage> {
  const query = new URLSearchParams({
    maxResults: String(params.maxResults),
    singleEvents: "true",
    showDeleted: "true",
  });
  if (isIncrementalParams(params)) {
    query.set("syncToken", params.syncToken);
  } else {
    query.set("timeMin", params.timeMin);
    query.set("timeMax", params.timeMax);
  }
  if (params.pageToken) query.set("pageToken", params.pageToken);

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(providerCalendarId)}/events?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleCalendarApiError(`Google Calendar API error ${response.status}: ${body.slice(0, 200)}`, response.status);
  }
  const data = (await response.json()) as { items?: GoogleCalendarEventApiItem[]; nextPageToken?: string; nextSyncToken?: string };
  return { items: data.items ?? [], nextPageToken: data.nextPageToken, nextSyncToken: data.nextSyncToken };
}
