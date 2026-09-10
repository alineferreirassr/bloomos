import { GoogleCalendarApiError } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarListApiItem {
  id: string;
  summary?: string;
  description?: string;
  timeZone?: string;
  accessRole?: string;
  primary?: boolean;
}

export interface GoogleCalendarListApiPage {
  items: GoogleCalendarListApiItem[];
  nextPageToken?: string;
}

/**
 * GCAL-03 — the one, minimal REST call this checkpoint's calendar-list
 * persistence needs: `GET /users/me/calendarList`, one page at a time.
 * Same standalone-client precedent as `googleCalendarIdentity.ts`
 * (plain `fetch`, reuses that file's own `GoogleCalendarApiError` rather
 * than duplicating it) — never reaches into `GoogleCalendarProvider`
 * (`core/integrations/providers/googleCalendar/`), the pre-existing
 * outbound write-capable adapter, which this checkpoint leaves untouched.
 *
 * Confirmed by Google's own published API surface: `calendarList.list`
 * is fully covered by the `calendar.readonly` scope this checkpoint's
 * connection requests — no broader scope was needed.
 *
 * Maps only the fields GCAL-03 actually persists (`id`, `summary`,
 * `description`, `timeZone`, `accessRole`, `primary`) — deliberately
 * never reads/forwards `backgroundColor`/`foregroundColor`/`colorId`/
 * `conferenceProperties`/`notificationSettings`/`defaultReminders`/
 * `hidden`/`deleted`/`etag`, none of which this checkpoint's schema has
 * a column for.
 */
export async function listGoogleCalendars(accessToken: string, params: { maxResults: number; pageToken?: string }): Promise<GoogleCalendarListApiPage> {
  const query = new URLSearchParams({ maxResults: String(params.maxResults) });
  if (params.pageToken) query.set("pageToken", params.pageToken);

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleCalendarApiError(`Google Calendar API error ${response.status}: ${body.slice(0, 200)}`, response.status);
  }
  const data = (await response.json()) as { items?: GoogleCalendarListApiItem[]; nextPageToken?: string };
  return { items: data.items ?? [], nextPageToken: data.nextPageToken };
}
