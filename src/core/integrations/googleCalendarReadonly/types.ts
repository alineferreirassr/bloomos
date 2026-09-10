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
