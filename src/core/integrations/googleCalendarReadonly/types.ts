/**
 * GCAL-02 — Member-Owned Google Calendar (Read-Only) Account Foundation.
 * Schema and type layer only: nothing here calls the Google Calendar API,
 * syncs any event, or renders anything. Deliberately its own domain,
 * separate from `core/integrations/providers/googleCalendar/` (the
 * pre-existing, workspace-owned, write-capable `google-calendar`
 * provider) — see `calendarProviders.ts`'s own doc comment for why two
 * separate provider ids exist for the same real-world service.
 *
 * Provider-native identity (`provider_account_id`, `provider_account_email`)
 * is kept separate from this codebase's own internal `id` (uuid) — never
 * conflated, never used interchangeably. Google's own `calendars.get`
 * response for a user's primary calendar has no separate opaque "account
 * id" distinct from the account's email — both fields are set to the
 * same value here, honestly reflecting what the API actually returns
 * (see `googleCalendarIdentity.ts`'s own doc comment).
 */

export type GoogleCalendarAccountSyncStatus = "not_synced" | "syncing" | "synced" | "error";

export interface GoogleCalendarAccount {
  id: string;
  workspace_id: string;
  member_id: string;
  integration_connection_id: string;
  /** Google's own primary-calendar `id` — for a primary calendar this is the account's email address. Null until `identifyPrimaryAccount` has run once. */
  provider_account_id: string | null;
  /** Same underlying value as `provider_account_id` — see this file's own header comment for why Google's API doesn't expose a distinct opaque account id here. Null until identified. */
  provider_account_email: string | null;
  sync_status: GoogleCalendarAccountSyncStatus;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  /** A short, non-sensitive, machine-readable code (e.g. "google_calendar_unauthorized") — never a raw provider error body. */
  sync_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertGoogleCalendarAccountParams {
  workspaceId: string;
  memberId: string;
  integrationConnectionId: string;
  providerAccountId?: string | null;
  providerAccountEmail?: string | null;
  syncStatus?: GoogleCalendarAccountSyncStatus;
  lastSyncedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  syncErrorCode?: string | null;
}

/**
 * GCAL-03 — one row per calendar visible to a connected
 * `google_calendar_accounts` row (Google's own `calendarList.list`
 * entries — the calendars the account can see, not the events inside
 * them). `sync_token` is added now, per GCAL-01's own finding that
 * Google's sync token is issued per-calendar (not per-account like
 * Gmail's `history_id`) — so a later checkpoint (GCAL-05) can populate
 * it without a second migration. GCAL-03 itself never populates or
 * reads it — always null here.
 */
export interface GoogleCalendar {
  id: string;
  workspace_id: string;
  member_id: string;
  account_id: string;
  /** Google's own calendar id — often the owner's email for a primary/owned calendar, or an opaque `...@group.calendar.google.com` id for a shared one. Kept structurally distinct from this row's own internal `id`. */
  provider_calendar_id: string;
  summary: string | null;
  description: string | null;
  time_zone: string | null;
  access_role: string | null;
  /** Set only from Google's own `primary === true` field — never inferred (e.g. never from provider_calendar_id matching the account's own email). */
  is_primary: boolean;
  /** Persisted user intent — see `upsertCalendar`'s own doc comment for exactly when this is (and is not) touched. */
  is_selected: boolean;
  /** Always null through GCAL-03 — reserved for GCAL-05's incremental sync. */
  sync_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertGoogleCalendarParams {
  workspaceId: string;
  memberId: string;
  accountId: string;
  providerCalendarId: string;
  summary?: string | null;
  description?: string | null;
  timeZone?: string | null;
  accessRole?: string | null;
  isPrimary?: boolean;
  /** Omit to leave an existing row's selection untouched (the normal refresh case) — only ever explicitly set for a newly-created row's own initial default. See `upsertCalendar`'s own doc comment. */
  isSelected?: boolean;
}

/** GCAL-04 — deliberately minimized: never Google's full attendee/organizer object (no `comment`, `additionalGuests`, or arbitrary provider extensions). */
export interface GoogleCalendarEventOrganizer {
  email: string;
  displayName: string | null;
  self: boolean;
}

export interface GoogleCalendarEventAttendee {
  email: string;
  displayName: string | null;
  responseStatus: string | null;
  self: boolean;
  optional: boolean;
}

/**
 * GCAL-04 — one row per event instance already expanded from any
 * recurring series (Google's own `events.list?singleEvents=true`
 * entries) — never a recurring series master. All-day and timed events
 * keep mutually exclusive column pairs (`start_date`/`end_date` vs
 * `start_date_time`/`end_date_time`) rather than coercing one
 * representation into the other — see the migration's own header
 * comment for why. `end_date` is Google's own exclusive end date,
 * preserved faithfully.
 */
export interface GoogleCalendarEvent {
  id: string;
  workspace_id: string;
  member_id: string;
  calendar_id: string;
  provider_event_id: string;
  i_cal_uid: string | null;
  recurring_event_id: string | null;
  original_start_time: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  /** Google's own raw status string — `cancelled_at` below is this table's canonical tombstone signal, not this column. */
  status: string | null;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  start_date_time: string | null;
  end_date_time: string | null;
  time_zone: string | null;
  organizer: GoogleCalendarEventOrganizer | null;
  attendees: GoogleCalendarEventAttendee[];
  html_link: string | null;
  hangout_link: string | null;
  /** GCAL-04 — null = active. Set once, on the first sync that observes `status === "cancelled"` — never overwritten on a later replay of the same cancellation ("first tombstone wins", mirroring `gmail_messages.deleted_at`'s own established idempotency precedent exactly). Cleared back to null if the event legitimately becomes active again (resurrection). */
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertGoogleCalendarEventParams {
  workspaceId: string;
  memberId: string;
  calendarId: string;
  providerEventId: string;
  iCalUid?: string | null;
  recurringEventId?: string | null;
  originalStartTime?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  /** Google's own raw status string for this sync — used only to derive `cancelled_at`; never persisted as a second, redundant deletion signal. */
  status?: string | null;
  allDay: boolean;
  startDate?: string | null;
  endDate?: string | null;
  startDateTime?: string | null;
  endDateTime?: string | null;
  timeZone?: string | null;
  organizer?: GoogleCalendarEventOrganizer | null;
  attendees?: GoogleCalendarEventAttendee[];
  htmlLink?: string | null;
  hangoutLink?: string | null;
}
