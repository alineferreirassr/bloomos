import { nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import { listConnections } from "@/core/integrations/integrationManager";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { GoogleCalendarApiError, getPrimaryCalendarAccountIdentity } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";
import { listGoogleCalendars, type GoogleCalendarListApiItem } from "@/core/integrations/googleCalendarReadonly/googleCalendarListApi";
import { listGoogleCalendarEvents, type GoogleCalendarEventApiItem } from "@/core/integrations/googleCalendarReadonly/googleCalendarEventApi";
import {
  calendarExistsForAccount,
  getOwnAccount,
  listCalendarsForCaller,
  upsertAccount,
  upsertCalendar,
  upsertCalendarEvent,
  type GoogleCalendarCallerScope,
} from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import type { IntegrationConnection } from "@/core/integrations/types";
import type { GoogleCalendar, GoogleCalendarAccount, GoogleCalendarEventAttendee, GoogleCalendarEventOrganizer, UpsertGoogleCalendarEventParams } from "@/core/integrations/googleCalendarReadonly/types";

/**
 * GCAL-02 — the Google Calendar (read-only) Account Service. Orchestrates
 * a single "identify my account" run for one member's own
 * `google-calendar-readonly` connection: resolve/refresh the access token
 * (reusing the shared `refreshProviderOAuthConnectionAction` — no second
 * refresh system, same reuse `gmailSyncEngine.ts` already established),
 * then makes the one Google Calendar API call this checkpoint authorizes
 * (`GET /calendars/primary`) and persists the result through
 * `googleCalendarAccountManager.ts`.
 *
 * No calendar listing, no event sync, no writes to Google — this file's
 * entire API surface is the single identification call.
 */

export const GOOGLE_CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const TOKEN_EXPIRY_REFRESH_MARGIN_MS = 2 * 60 * 1000;

/**
 * GCAL-03 — conservative, explicit, server-side bounds for a calendar-
 * list run, matching Gmail's own "conservative, explicit, server-side"
 * bound philosophy (`gmailSyncEngine.ts`'s `GMAIL_SYNC_*` constants) —
 * calendar counts, adapted for the domain: a person's calendar list is
 * normally small (a handful to a few dozen), so a low hard ceiling is
 * appropriate. `CALENDAR_LIST_PAGE_SIZE` stays well under Google's own
 * documented `maxResults` maximum of 250 for `calendarList.list`;
 * `CALENDAR_LIST_MAX_PAGES` is a hard safety ceiling independent of the
 * calendar-count accounting below, guaranteeing the list loop terminates
 * even if a page ever reports an unexpectedly small result count (same
 * role `GMAIL_SYNC_MAX_PAGES` plays for Gmail's own full listing).
 */
export const CALENDAR_LIST_PAGE_SIZE = 50;
export const CALENDAR_LIST_MAX_PAGES = 5;
export const CALENDAR_LIST_MAX_CALENDARS = 200;

/**
 * GCAL-04 — conservative, explicit, server-side bounds for a bounded
 * initial event sync, same philosophy as the calendar-list bounds
 * above. `EVENTS_PAGE_SIZE` stays at Google's own documented default
 * for `events.list` (250, also comfortably under its max of 2500);
 * `EVENTS_MAX_PAGES`/`EVENTS_MAX_EVENTS` are hard safety ceilings
 * (independent of each other, exactly like `GMAIL_SYNC_MAX_PAGES`
 * guarantees Gmail's own full-listing loop terminates even against a
 * pathological always-more-pages response) — these bounds apply
 * per-calendar (GCAL-04 syncs each selected calendar as its own
 * independent bounded unit, see `syncOwnGoogleCalendarEvents`'s own
 * doc comment), not in aggregate across every selected calendar.
 */
export const EVENTS_PAGE_SIZE = 250;
export const EVENTS_MAX_PAGES = 10;
export const EVENTS_MAX_EVENTS = 1000;

/**
 * GCAL-04 — the bounded initial sync window: no repository precedent
 * exists for a time-windowed sync (Gmail's own bounds are thread-count-
 * based, not date-range-based), so these are fresh, explicit,
 * documented defaults rather than an inherited convention — 30 days of
 * past history plus 90 days of upcoming events, matching this
 * checkpoint's own recommended starting values.
 */
export const GCAL_INITIAL_PAST_DAYS = 30;
export const GCAL_INITIAL_FUTURE_DAYS = 90;

export type IdentifyGoogleCalendarAccountResult =
  | { status: "success"; account: GoogleCalendarAccount }
  | { status: "no_connection" }
  | { status: "reconnect_required"; reason: string }
  | { status: "error"; reason: string };

export interface GoogleCalendarAccountCaller {
  workspaceId: string;
  memberId: string;
}

async function findOwnGoogleCalendarConnection(caller: GoogleCalendarAccountCaller): Promise<IntegrationConnection | null> {
  const connections = await listConnections(caller.workspaceId);
  return connections.find((connection) => connection.provider_id === "google-calendar-readonly" && connection.member_id === caller.memberId) ?? null;
}

/** Non-sensitive, machine-readable classification of a Google Calendar API failure — never the raw provider response body. Mirrors `gmailSyncEngine.ts`'s own `classifyGmailApiError`, adapted for Calendar's own status-code meanings (GCAL-02 scope: no sync-token/410 handling yet — that's GCAL-05's). */
function classifyGoogleCalendarApiError(error: unknown): { code: string; reconnectRequired: boolean } {
  if (error instanceof GoogleCalendarApiError) {
    if (error.status === 401) return { code: "google_calendar_unauthorized", reconnectRequired: true };
    if (error.status === 403) return { code: "google_calendar_forbidden", reconnectRequired: false };
    if (error.status === 404) return { code: "google_calendar_not_found", reconnectRequired: false };
    if (error.status === 429) return { code: "google_calendar_rate_limited", reconnectRequired: false };
    if (error.status >= 500) return { code: "google_calendar_provider_error", reconnectRequired: false };
    return { code: `google_calendar_api_error_${error.status}`, reconnectRequired: false };
  }
  return { code: "identification_failed", reconnectRequired: false };
}

/** Resolves a real, usable access token for this connection's credential — refreshing it first (reusing the shared `refreshProviderOAuthConnectionAction`) when it's missing, already expired, or close enough to expiry to risk failing mid-call. Returns null when no usable token could be obtained at all. Mirrors `gmailSyncEngine.ts`'s own `ensureFreshAccessToken` — deliberately not extracted into shared code, matching that same precedent of a small per-domain helper reusing the one shared refresh action. */
async function ensureFreshAccessToken(connection: IntegrationConnection, credentialId: string): Promise<string | null> {
  const credential = await getCredential(credentialId);
  if (!credential) return null;

  const isExpiringSoon = credential.expires_at !== null && new Date(credential.expires_at).getTime() < Date.now() + TOKEN_EXPIRY_REFRESH_MARGIN_MS;
  const needsRefresh = connection.state === "expired" || isExpiringSoon;

  if (!needsRefresh) {
    const token = await resolveAccessToken(credentialId);
    if (token) return token;
  }

  const refreshed = await refreshProviderOAuthConnectionAction(connection.id);
  if (!refreshed.success || !refreshed.data.credential_id) return null;
  return resolveAccessToken(refreshed.data.credential_id);
}

async function markAccountError(caller: GoogleCalendarAccountCaller, connectionId: string, errorCode: string): Promise<void> {
  await upsertAccount({
    workspaceId: caller.workspaceId,
    memberId: caller.memberId,
    integrationConnectionId: connectionId,
    syncStatus: "error",
    lastSyncedAt: nowIso(),
    syncErrorCode: errorCode,
  }).catch((error) => {
    getLogger().error("Google Calendar identify: could not record error on the account row", { connectionId, error: error instanceof Error ? error.message : "unknown" });
  });
}

/**
 * Identifies the caller's own connected Google Calendar account.
 * `workspaceId`/`memberId` must already come from an authenticated
 * server session — never accepts a connection id from an untrusted
 * caller. The only connection ever touched is the one
 * `google-calendar-readonly` connection this exact member owns in this
 * exact workspace.
 */
export async function identifyOwnGoogleCalendarAccount(caller: GoogleCalendarAccountCaller): Promise<IdentifyGoogleCalendarAccountResult> {
  const connection = await findOwnGoogleCalendarConnection(caller);
  if (!connection) return { status: "no_connection" };
  if (connection.workspace_id !== caller.workspaceId || connection.member_id !== caller.memberId) return { status: "no_connection" };

  if (!connection.credential_id) return { status: "reconnect_required", reason: "no_credential" };
  const credential = await getCredential(connection.credential_id);
  if (!credential || credential.kind !== "oauth_token") return { status: "reconnect_required", reason: "no_credential" };

  if (!credential.scopes.includes(GOOGLE_CALENDAR_READONLY_SCOPE)) return { status: "reconnect_required", reason: "missing_readonly_scope" };

  if (connection.state !== "connected" && connection.state !== "expired") {
    return { status: "error", reason: `Google Calendar connection is currently "${connection.state}" — cannot identify account.` };
  }

  const accessToken = await ensureFreshAccessToken(connection, connection.credential_id);
  if (!accessToken) return { status: "reconnect_required", reason: "refresh_failed" };

  const scopeCaller: GoogleCalendarCallerScope = { workspaceId: caller.workspaceId, memberId: caller.memberId };
  try {
    await upsertAccount({ workspaceId: caller.workspaceId, memberId: caller.memberId, integrationConnectionId: connection.id, syncStatus: "syncing" });
  } catch (error) {
    getLogger().error("Google Calendar identify: could not establish the account row", { connectionId: connection.id, error: error instanceof Error ? error.message : "unknown" });
    return { status: "error", reason: "account_upsert_failed" };
  }

  try {
    const identity = await getPrimaryCalendarAccountIdentity(accessToken);
    const syncedAt = nowIso();
    const account = await upsertAccount({
      workspaceId: caller.workspaceId,
      memberId: caller.memberId,
      integrationConnectionId: connection.id,
      providerAccountId: identity.providerAccountId,
      providerAccountEmail: identity.providerAccountEmail,
      syncStatus: "synced",
      lastSyncedAt: syncedAt,
      lastSuccessfulSyncAt: syncedAt,
      syncErrorCode: null,
    });
    return { status: "success", account };
  } catch (error) {
    const { code, reconnectRequired } = classifyGoogleCalendarApiError(error);
    getLogger().error("Google Calendar account identification failed", { connectionId: connection.id, code });
    await markAccountError(scopeCaller, connection.id, code);
    if (reconnectRequired) return { status: "reconnect_required", reason: code };
    return { status: "error", reason: code };
  }
}

export type ListGoogleCalendarsResult =
  | { status: "success"; calendars: GoogleCalendar[] }
  | { status: "no_connection" }
  | { status: "reconnect_required"; reason: string }
  | { status: "error"; reason: string };

/**
 * GCAL-03 — lists the caller's own Google calendars (`calendarList.list`)
 * and persists them through `googleCalendarAccountManager.ts`. Never
 * calls any `events.*` endpoint — this file's Calendar API surface is
 * exactly `GET /calendars/primary` (identification, above) and
 * `GET /users/me/calendarList` (this function).
 *
 * Fetches the *entire* bounded listing (up to `CALENDAR_LIST_MAX_PAGES`/
 * `CALENDAR_LIST_MAX_CALENDARS`) before persisting anything — a
 * mid-pagination failure therefore never leaves existing calendar rows
 * partially overwritten by an incomplete page; on such a failure this
 * returns an error status and touches no `google_calendars` row at all
 * (existing rows are left exactly as they were).
 *
 * A calendar no longer present in a later listing is never deleted or
 * marked stale here — GCAL-03 has no evidenced need for that semantic
 * yet (nothing downstream depends on distinguishing "still visible" from
 * "not seen in the latest listing" before event sync exists), so the
 * row is simply left untouched, exactly as GCAL-03's own authorization
 * prefers when no stale marker is otherwise necessary.
 */
export async function listAndPersistOwnGoogleCalendars(caller: GoogleCalendarAccountCaller): Promise<ListGoogleCalendarsResult> {
  const connection = await findOwnGoogleCalendarConnection(caller);
  if (!connection) return { status: "no_connection" };
  if (connection.workspace_id !== caller.workspaceId || connection.member_id !== caller.memberId) return { status: "no_connection" };

  if (!connection.credential_id) return { status: "reconnect_required", reason: "no_credential" };
  const credential = await getCredential(connection.credential_id);
  if (!credential || credential.kind !== "oauth_token") return { status: "reconnect_required", reason: "no_credential" };

  if (!credential.scopes.includes(GOOGLE_CALENDAR_READONLY_SCOPE)) return { status: "reconnect_required", reason: "missing_readonly_scope" };

  if (connection.state !== "connected" && connection.state !== "expired") {
    return { status: "error", reason: `Google Calendar connection is currently "${connection.state}" — cannot list calendars.` };
  }

  const scopeCaller: GoogleCalendarCallerScope = { workspaceId: caller.workspaceId, memberId: caller.memberId };
  const account = await getOwnAccount(scopeCaller);
  if (!account) return { status: "error", reason: "account_not_identified" };

  const accessToken = await ensureFreshAccessToken(connection, connection.credential_id);
  if (!accessToken) return { status: "reconnect_required", reason: "refresh_failed" };

  const items: GoogleCalendarListApiItem[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  try {
    do {
      const page = await listGoogleCalendars(accessToken, { maxResults: CALENDAR_LIST_PAGE_SIZE, pageToken });
      pagesFetched++;
      for (const item of page.items) {
        if (items.length >= CALENDAR_LIST_MAX_CALENDARS) break;
        items.push(item);
      }
      pageToken = page.nextPageToken;
    } while (pageToken && items.length < CALENDAR_LIST_MAX_CALENDARS && pagesFetched < CALENDAR_LIST_MAX_PAGES);
  } catch (error) {
    const { code, reconnectRequired } = classifyGoogleCalendarApiError(error);
    getLogger().error("Google Calendar list failed", { connectionId: connection.id, code });
    await markAccountError(scopeCaller, connection.id, code);
    if (reconnectRequired) return { status: "reconnect_required", reason: code };
    return { status: "error", reason: code };
  }

  const persisted: GoogleCalendar[] = [];
  for (const item of items) {
    try {
      // A brand-new row gets an explicit default selection (true only for
      // the primary calendar); an already-persisted row's own prior
      // selection is left untouched by omitting isSelected entirely — see
      // upsertCalendar's own doc comment for why this distinction matters.
      const isNew = !(await calendarExistsForAccount(account.id, item.id, scopeCaller));
      const isPrimary = item.primary === true;
      const calendar = await upsertCalendar({
        workspaceId: caller.workspaceId,
        memberId: caller.memberId,
        accountId: account.id,
        providerCalendarId: item.id,
        summary: item.summary ?? null,
        description: item.description ?? null,
        timeZone: item.timeZone ?? null,
        accessRole: item.accessRole ?? null,
        isPrimary,
        ...(isNew ? { isSelected: isPrimary } : {}),
      });
      persisted.push(calendar);
    } catch (error) {
      getLogger().error("Google Calendar list: could not persist one calendar", { connectionId: connection.id, providerCalendarId: item.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  const syncedAt = nowIso();
  await upsertAccount({
    workspaceId: caller.workspaceId,
    memberId: caller.memberId,
    integrationConnectionId: connection.id,
    syncStatus: "synced",
    lastSyncedAt: syncedAt,
    lastSuccessfulSyncAt: syncedAt,
    syncErrorCode: null,
  });

  return { status: "success", calendars: persisted };
}

/**
 * GCAL-04 — maps one raw `events.list` item to the manager's own
 * upsert shape (everything except `workspaceId`/`memberId`/
 * `calendarId`, which the caller supplies). All-day vs timed is
 * determined solely by which of `start.date`/`start.dateTime` Google
 * actually returned — never inferred from any other field, and never
 * coerced into a UTC timestamp: an all-day event's `date` strings are
 * persisted exactly as received (including `end.date`'s own exclusive-
 * end convention, untouched — see the migration's own header comment).
 * A malformed/minimal event body (e.g. some cancellation payloads carry
 * no `start`/`end` at all) safely falls through to `all_day: false`
 * with every date/time field left `null`, rather than throwing.
 *
 * `timeZone` prefers the event's own `start.timeZone`, falling back to
 * `end.timeZone` — Google does not otherwise expose the owning
 * calendar's own default timeZone on the event resource itself, so no
 * further fallback is attempted here.
 *
 * Attendee/organizer objects are deliberately narrowed to exactly the
 * fields `GoogleCalendarEventOrganizer`/`GoogleCalendarEventAttendee`
 * declare — see those types' own doc comments for why the rest of
 * Google's object is never read or persisted.
 */
function mapGoogleCalendarEventItem(item: GoogleCalendarEventApiItem): Omit<UpsertGoogleCalendarEventParams, "workspaceId" | "memberId" | "calendarId"> {
  const start = item.start;
  const end = item.end;
  const allDay = Boolean(start?.date);

  const organizer: GoogleCalendarEventOrganizer | null = item.organizer?.email
    ? { email: item.organizer.email, displayName: item.organizer.displayName ?? null, self: item.organizer.self === true }
    : null;
  const attendees: GoogleCalendarEventAttendee[] = (item.attendees ?? [])
    .filter((attendee) => attendee.email)
    .map((attendee) => ({
      email: attendee.email as string,
      displayName: attendee.displayName ?? null,
      responseStatus: attendee.responseStatus ?? null,
      self: attendee.self === true,
      optional: attendee.optional === true,
    }));

  return {
    providerEventId: item.id,
    iCalUid: item.iCalUID ?? null,
    recurringEventId: item.recurringEventId ?? null,
    originalStartTime: item.originalStartTime ? (item.originalStartTime.date ?? item.originalStartTime.dateTime ?? null) : null,
    summary: item.summary ?? null,
    description: item.description ?? null,
    location: item.location ?? null,
    status: item.status ?? null,
    allDay,
    startDate: allDay ? (start?.date ?? null) : null,
    endDate: allDay ? (end?.date ?? null) : null,
    startDateTime: !allDay ? (start?.dateTime ?? null) : null,
    endDateTime: !allDay ? (end?.dateTime ?? null) : null,
    timeZone: start?.timeZone ?? end?.timeZone ?? null,
    organizer,
    attendees,
    htmlLink: item.htmlLink ?? null,
    hangoutLink: item.hangoutLink ?? null,
  };
}

export interface CalendarEventSyncOutcome {
  calendarId: string;
  status: "success" | "reconnect_required" | "error";
  eventsProcessed?: number;
  reason?: string;
}

export type SyncGoogleCalendarEventsResult =
  | { status: "success"; results: CalendarEventSyncOutcome[] }
  | { status: "no_connection" }
  | { status: "no_selected_calendars" }
  | { status: "reconnect_required"; reason: string }
  | { status: "error"; reason: string };

/**
 * GCAL-04 — syncs one calendar's events as its own independent bounded
 * unit: fetches the *entire* bounded page set into memory first, then
 * persists — a mid-pagination failure therefore returns an error
 * outcome for exactly this calendar without touching any of its
 * existing rows (matching `listAndPersistOwnGoogleCalendars`'s own
 * "atomic logical completion" choice), and never affects any other
 * selected calendar's own outcome.
 */
async function syncOneCalendarEvents(params: {
  workspaceId: string;
  memberId: string;
  calendarId: string;
  providerCalendarId: string;
  accessToken: string;
  timeMin: string;
  timeMax: string;
}): Promise<CalendarEventSyncOutcome> {
  const items: GoogleCalendarEventApiItem[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  try {
    do {
      const page = await listGoogleCalendarEvents(params.accessToken, params.providerCalendarId, { timeMin: params.timeMin, timeMax: params.timeMax, maxResults: EVENTS_PAGE_SIZE, pageToken });
      pagesFetched++;
      for (const item of page.items) {
        if (items.length >= EVENTS_MAX_EVENTS) break;
        items.push(item);
      }
      pageToken = page.nextPageToken;
    } while (pageToken && items.length < EVENTS_MAX_EVENTS && pagesFetched < EVENTS_MAX_PAGES);
  } catch (error) {
    const { code, reconnectRequired } = classifyGoogleCalendarApiError(error);
    getLogger().error("Google Calendar event sync failed for one calendar", { calendarId: params.calendarId, code });
    return { calendarId: params.calendarId, status: reconnectRequired ? "reconnect_required" : "error", reason: code };
  }

  let eventsProcessed = 0;
  for (const item of items) {
    try {
      const mapped = mapGoogleCalendarEventItem(item);
      await upsertCalendarEvent({ workspaceId: params.workspaceId, memberId: params.memberId, calendarId: params.calendarId, ...mapped });
      eventsProcessed++;
    } catch (error) {
      getLogger().error("Google Calendar event sync: could not persist one event", { calendarId: params.calendarId, providerEventId: item.id, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  return { calendarId: params.calendarId, status: "success", eventsProcessed };
}

/**
 * GCAL-04 — the bounded initial event sync entry point. Applies only to
 * the caller's own `is_selected = true` calendars (GCAL-03's own
 * persisted selection state) — never every persisted calendar, and
 * never an arbitrary fallback when nothing is selected
 * (`no_selected_calendars` is returned instead). Each selected calendar
 * is synced as its own independent unit (`syncOneCalendarEvents`) — one
 * calendar's failure is reported in that calendar's own outcome only
 * and never marks a different, successfully-synced calendar's own
 * outcome as failed.
 *
 * `sync_token` is never read or written here — GCAL-04 is a bounded,
 * time-windowed listing only; GCAL-05 owns incremental sync and cursor
 * activation. `now` is injectable (defaults to the real current time)
 * so tests can exercise the bounded window deterministically without
 * depending on wall-clock time.
 */
export async function syncOwnGoogleCalendarEvents(caller: GoogleCalendarAccountCaller, now: Date = new Date()): Promise<SyncGoogleCalendarEventsResult> {
  const connection = await findOwnGoogleCalendarConnection(caller);
  if (!connection) return { status: "no_connection" };
  if (connection.workspace_id !== caller.workspaceId || connection.member_id !== caller.memberId) return { status: "no_connection" };

  if (!connection.credential_id) return { status: "reconnect_required", reason: "no_credential" };
  const credential = await getCredential(connection.credential_id);
  if (!credential || credential.kind !== "oauth_token") return { status: "reconnect_required", reason: "no_credential" };

  if (!credential.scopes.includes(GOOGLE_CALENDAR_READONLY_SCOPE)) return { status: "reconnect_required", reason: "missing_readonly_scope" };

  if (connection.state !== "connected" && connection.state !== "expired") {
    return { status: "error", reason: `Google Calendar connection is currently "${connection.state}" — cannot sync events.` };
  }

  const scopeCaller: GoogleCalendarCallerScope = { workspaceId: caller.workspaceId, memberId: caller.memberId };
  const account = await getOwnAccount(scopeCaller);
  if (!account) return { status: "error", reason: "account_not_identified" };

  const calendars = await listCalendarsForCaller(account.id, scopeCaller);
  const selectedCalendars = calendars.filter((calendar) => calendar.is_selected);
  if (selectedCalendars.length === 0) return { status: "no_selected_calendars" };

  const accessToken = await ensureFreshAccessToken(connection, connection.credential_id);
  if (!accessToken) return { status: "reconnect_required", reason: "refresh_failed" };

  const timeMin = new Date(now.getTime() - GCAL_INITIAL_PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + GCAL_INITIAL_FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const results: CalendarEventSyncOutcome[] = [];
  for (const calendar of selectedCalendars) {
    const outcome = await syncOneCalendarEvents({
      workspaceId: caller.workspaceId,
      memberId: caller.memberId,
      calendarId: calendar.id,
      providerCalendarId: calendar.provider_calendar_id,
      accessToken,
      timeMin,
      timeMax,
    });
    results.push(outcome);
  }

  return { status: "success", results };
}
