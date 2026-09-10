const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/** A Google Calendar API error carrying the real HTTP status, so callers can classify 401/403/404/429/5xx without re-parsing a message string — same shape as `GmailApiError`. */
export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

interface GoogleCalendarApiCalendar {
  /** For the `primary` calendar, this is the connected account's own email address — Google exposes no other, distinct opaque "account id" at this endpoint. */
  id: string;
  summary?: string;
  timeZone?: string;
}

export interface PrimaryCalendarAccountIdentity {
  /** Same value as `email` — see this file's own header comment and `GoogleCalendarAccount`'s own doc comment for why. */
  providerAccountId: string;
  providerAccountEmail: string;
}

/**
 * GCAL-02 — the one, minimal REST call this checkpoint's account
 * foundation needs: `GET /calendars/primary`, used solely to identify
 * which Google account a member just connected. Deliberately its own
 * standalone client, separate from `GoogleCalendarProvider`
 * (`core/integrations/providers/googleCalendar/`) — that class is the
 * pre-existing, workspace-owned, write-capable outbound adapter and is
 * explicitly left untouched by this checkpoint (see GCAL-02's own
 * authorization). Plain `fetch`, no `googleapis` dependency, matching
 * both `GoogleCalendarProvider`'s and `GmailProvider`'s own established
 * pattern for this codebase.
 *
 * Never fetches calendar lists, events, or anything beyond this one
 * identification call — GCAL-02's own explicit boundary.
 */
export async function getPrimaryCalendarAccountIdentity(accessToken: string): Promise<PrimaryCalendarAccountIdentity> {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/calendars/primary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new GoogleCalendarApiError(`Google Calendar API error ${response.status}: ${body.slice(0, 200)}`, response.status);
  }
  const calendar = (await response.json()) as GoogleCalendarApiCalendar;
  // Google's own primary-calendar `id` IS the account's email address — no separate identity scope was requested, and none is added here.
  return { providerAccountId: calendar.id, providerAccountEmail: calendar.id };
}
