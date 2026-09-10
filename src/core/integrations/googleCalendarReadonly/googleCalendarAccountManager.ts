import { nowIso } from "@/lib/data/utils";
import { getConnection } from "@/core/integrations/integrationManager";
import {
  generateGoogleCalendarAccountId,
  getAccountByConnectionId,
  getAccountById,
  insertAccount,
  listAccountsForWorkspace,
  updateAccount,
} from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import {
  generateGoogleCalendarId,
  getCalendarById,
  getCalendarByProviderId,
  insertCalendar,
  listCalendarsForAccount,
  updateCalendar,
} from "@/lib/data/core/integrations/googleCalendarReadonly/calendarStore";
import type { GoogleCalendar, GoogleCalendarAccount, UpsertGoogleCalendarAccountParams, UpsertGoogleCalendarParams } from "@/core/integrations/googleCalendarReadonly/types";

/**
 * GCAL-02 — the Google Calendar (read-only) Account Manager, mirroring
 * `gmail/gmailMailboxManager.ts`'s exact role and shape: the one
 * orchestration layer every caller (the identification service, an
 * eventual sync engine) goes through — no call site reaches into
 * `accountStore.ts` directly.
 *
 * Ownership enforcement lives entirely here, not in the store: every
 * write validates the caller's own `workspaceId`/`memberId` against the
 * actual owning row (the connection for an account), the same
 * "store never enforces ownership, the manager above it does" split
 * `gmailMailboxManager.ts` already established.
 *
 * This file performs NO Google Calendar API calls — pure persistence
 * orchestration for whatever `googleCalendarAccountService.ts` produces.
 */
export interface GoogleCalendarCallerScope {
  workspaceId: string;
  memberId: string;
}

function isOwnedByCaller(row: { workspace_id: string; member_id: string }, caller: GoogleCalendarCallerScope): boolean {
  return row.workspace_id === caller.workspaceId && row.member_id === caller.memberId;
}

/** The DB-level FK on `google_calendar_accounts.integration_connection_id` can't itself enforce "this is really a google-calendar-readonly connection owned by this exact workspace/member" (see the migration's own header comment) — this is that check, done here instead. */
async function assertGoogleCalendarConnectionOwnership(integrationConnectionId: string, caller: GoogleCalendarCallerScope): Promise<void> {
  const connection = await getConnection(integrationConnectionId);
  if (!connection) throw new Error("No integration connection found for this account.");
  if (connection.provider_id !== "google-calendar-readonly") throw new Error("This connection is not a Google Calendar (read-only) connection.");
  if (connection.workspace_id !== caller.workspaceId) throw new Error("This connection does not belong to the caller's workspace.");
  if (connection.member_id !== caller.memberId) throw new Error("This connection is not owned by the caller.");
}

/** Insert-or-update by the account's own `integration_connection_id` — idempotent, so the identification service can call this freely without tracking "have I created this account row yet" itself. */
export async function upsertAccount(params: UpsertGoogleCalendarAccountParams): Promise<GoogleCalendarAccount> {
  const caller: GoogleCalendarCallerScope = { workspaceId: params.workspaceId, memberId: params.memberId };
  await assertGoogleCalendarConnectionOwnership(params.integrationConnectionId, caller);

  const existing = await getAccountByConnectionId(params.integrationConnectionId);
  if (existing) {
    if (!isOwnedByCaller(existing, caller)) throw new Error("This account is not owned by the caller.");
    const updated = await updateAccount(existing.id, {
      provider_account_id: params.providerAccountId ?? existing.provider_account_id,
      provider_account_email: params.providerAccountEmail ?? existing.provider_account_email,
      sync_status: params.syncStatus ?? existing.sync_status,
      last_synced_at: params.lastSyncedAt ?? existing.last_synced_at,
      last_successful_sync_at: params.lastSuccessfulSyncAt ?? existing.last_successful_sync_at,
      sync_error_code: params.syncErrorCode ?? existing.sync_error_code,
    });
    if (!updated) throw new Error("Could not update this account.");
    return updated;
  }

  const now = nowIso();
  const account: GoogleCalendarAccount = {
    id: generateGoogleCalendarAccountId(),
    workspace_id: params.workspaceId,
    member_id: params.memberId,
    integration_connection_id: params.integrationConnectionId,
    provider_account_id: params.providerAccountId ?? null,
    provider_account_email: params.providerAccountEmail ?? null,
    sync_status: params.syncStatus ?? "not_synced",
    last_synced_at: params.lastSyncedAt ?? null,
    last_successful_sync_at: params.lastSuccessfulSyncAt ?? null,
    sync_error_code: params.syncErrorCode ?? null,
    created_at: now,
    updated_at: now,
  };
  return insertAccount(account);
}

export async function getAccountForCaller(accountId: string, caller: GoogleCalendarCallerScope): Promise<GoogleCalendarAccount | null> {
  const account = await getAccountById(accountId);
  if (!account || !isOwnedByCaller(account, caller)) return null;
  return account;
}

/** The caller's own account in their own workspace — at most one per member, since `google_calendar_accounts` is unique per `integration_connection_id` and this domain's own connection model (GCAL-02, `MEMBER_OWNED_PROVIDER_IDS`) is one `google-calendar-readonly` connection per member. */
export async function getOwnAccount(caller: GoogleCalendarCallerScope): Promise<GoogleCalendarAccount | null> {
  const accounts = await listAccountsForWorkspace(caller.workspaceId);
  return accounts.find((account) => account.member_id === caller.memberId) ?? null;
}

/** GCAL-03 — the DB-level FK on `google_calendars.account_id` can't itself enforce "this account belongs to this exact workspace/member" — this is that check, done here instead (mirrors `assertGoogleCalendarConnectionOwnership` above, one level down). */
async function assertAccountOwnership(accountId: string, caller: GoogleCalendarCallerScope): Promise<GoogleCalendarAccount> {
  const account = await getAccountById(accountId);
  if (!account) throw new Error("No Google Calendar account found for this calendar.");
  if (!isOwnedByCaller(account, caller)) throw new Error("This account is not owned by the caller.");
  return account;
}

/**
 * GCAL-03 — insert-or-update by `(accountId, providerCalendarId)`.
 *
 * `isSelected` is deliberately optional and asymmetric between the two
 * paths: on the INSERT path (a calendar seen for the first time) it
 * defaults to `false` when omitted — the service always supplies it
 * explicitly there (`true` only for the one primary calendar, per
 * GCAL-03's own default-selection rule). On the UPDATE path (a calendar
 * already persisted from an earlier listing) it defaults to the
 * *existing* row's own value when omitted, never to the newly-fetched
 * `is_primary` flag — this is what keeps a later user selection change
 * from being silently reverted by the next calendar-list refresh
 * (GCAL-03's own selection-preservation rule). The service achieves this
 * by only ever passing `isSelected` explicitly for a row it already
 * knows is new.
 */
export async function upsertCalendar(params: UpsertGoogleCalendarParams): Promise<GoogleCalendar> {
  const caller: GoogleCalendarCallerScope = { workspaceId: params.workspaceId, memberId: params.memberId };
  await assertAccountOwnership(params.accountId, caller);

  const existing = await getCalendarByProviderId(params.accountId, params.providerCalendarId);
  if (existing) {
    if (!isOwnedByCaller(existing, caller)) throw new Error("This calendar is not owned by the caller.");
    const updated = await updateCalendar(existing.id, {
      summary: params.summary ?? existing.summary,
      description: params.description ?? existing.description,
      time_zone: params.timeZone ?? existing.time_zone,
      access_role: params.accessRole ?? existing.access_role,
      is_primary: params.isPrimary ?? existing.is_primary,
      is_selected: params.isSelected ?? existing.is_selected,
    });
    if (!updated) throw new Error("Could not update this calendar.");
    return updated;
  }

  const now = nowIso();
  const calendar: GoogleCalendar = {
    id: generateGoogleCalendarId(),
    workspace_id: params.workspaceId,
    member_id: params.memberId,
    account_id: params.accountId,
    provider_calendar_id: params.providerCalendarId,
    summary: params.summary ?? null,
    description: params.description ?? null,
    time_zone: params.timeZone ?? null,
    access_role: params.accessRole ?? null,
    is_primary: params.isPrimary ?? false,
    is_selected: params.isSelected ?? false,
    sync_token: null,
    created_at: now,
    updated_at: now,
  };
  return insertCalendar(calendar);
}

export async function getCalendarForCaller(calendarId: string, caller: GoogleCalendarCallerScope): Promise<GoogleCalendar | null> {
  const calendar = await getCalendarById(calendarId);
  if (!calendar || !isOwnedByCaller(calendar, caller)) return null;
  return calendar;
}

/** Whether a calendar with this provider id has already been persisted for this account — used by the service to decide whether an upsert call is a genuinely new row (and should set a default selection) or a refresh of an existing one (and must leave selection untouched). Never exposes anything beyond that boolean-shaped answer to callers outside this manager. */
export async function calendarExistsForAccount(accountId: string, providerCalendarId: string, caller: GoogleCalendarCallerScope): Promise<boolean> {
  await assertAccountOwnership(accountId, caller);
  const existing = await getCalendarByProviderId(accountId, providerCalendarId);
  return existing !== null;
}

export async function listCalendarsForCaller(accountId: string, caller: GoogleCalendarCallerScope): Promise<GoogleCalendar[]> {
  await assertAccountOwnership(accountId, caller);
  return listCalendarsForAccount(accountId);
}
