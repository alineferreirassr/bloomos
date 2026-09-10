"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { identifyOwnGoogleCalendarAccount, listAndPersistOwnGoogleCalendars, syncOwnGoogleCalendarEvents } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";
import { getOwnAccount, listCalendarsForCaller, updateCalendarSelection } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import type { IdentifyGoogleCalendarAccountResult, ListGoogleCalendarsResult, SyncGoogleCalendarEventsResult } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";

export type IdentifyMyGoogleCalendarAccountResult = { success: true; data: Exclude<IdentifyGoogleCalendarAccountResult, { status: "error" }> } | { success: false; error: string };

/**
 * GCAL-02 — the canonical "identify my Google Calendar account" action.
 * `workspaceId`/`memberId` are derived from the authenticated server
 * session only — never from a client-supplied argument, so a caller
 * cannot direct this at an account that isn't their own. Returns only
 * safe summary data (sync status, the identified email, timestamps) or a
 * reconnect/no-connection/error signal — never a token.
 */
export async function identifyMyGoogleCalendarAccountAction(): Promise<IdentifyMyGoogleCalendarAccountResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await identifyOwnGoogleCalendarAccount({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (result.status === "error") return { success: false, error: result.reason };
  return { success: true, data: result };
}

export interface GoogleCalendarAccountSummary {
  syncStatus: string;
  providerAccountEmail: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncErrorCode: string | null;
}

export type GetOwnGoogleCalendarAccountSummaryResult = { success: true; data: GoogleCalendarAccountSummary | null } | { success: false; error: string };

/** The safe, summary-only account status a future Connect Panel would show — never a token, never any calendar/event content (none exists yet). */
export async function getOwnGoogleCalendarAccountSummaryAction(): Promise<GetOwnGoogleCalendarAccountSummaryResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const account = await getOwnAccount({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (!account) return { success: true, data: null };
  return {
    success: true,
    data: {
      syncStatus: account.sync_status,
      providerAccountEmail: account.provider_account_email,
      lastSyncedAt: account.last_synced_at,
      lastSuccessfulSyncAt: account.last_successful_sync_at,
      syncErrorCode: account.sync_error_code,
    },
  };
}

export interface GoogleCalendarSummary {
  id: string;
  summary: string | null;
  description: string | null;
  timeZone: string | null;
  accessRole: string | null;
  isPrimary: boolean;
  isSelected: boolean;
}

export type ListMyGoogleCalendarsData = { status: "success"; calendars: GoogleCalendarSummary[] } | Exclude<ListGoogleCalendarsResult, { status: "error" | "success" }>;
export type ListMyGoogleCalendarsResult = { success: true; data: ListMyGoogleCalendarsData } | { success: false; error: string };

function toCalendarSummary(calendar: { id: string; summary: string | null; description: string | null; time_zone: string | null; access_role: string | null; is_primary: boolean; is_selected: boolean }): GoogleCalendarSummary {
  return {
    id: calendar.id,
    summary: calendar.summary,
    description: calendar.description,
    timeZone: calendar.time_zone,
    accessRole: calendar.access_role,
    isPrimary: calendar.is_primary,
    isSelected: calendar.is_selected,
  };
}

/**
 * GCAL-03 — the canonical "list (and persist) my Google calendars"
 * action. `workspaceId`/`memberId` derive from the authenticated server
 * session only. Returns only the safe, mapped summary shape — never the
 * internal `workspace_id`/`member_id`/`account_id`/`sync_token` fields
 * the persisted row itself carries, and never a token.
 */
export async function listMyGoogleCalendarsAction(): Promise<ListMyGoogleCalendarsResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await listAndPersistOwnGoogleCalendars({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (result.status === "error") return { success: false, error: result.reason };
  if (result.status === "success") return { success: true, data: { status: "success", calendars: result.calendars.map(toCalendarSummary) } };
  return { success: true, data: result };
}

export type GetMyGoogleCalendarsResult = { success: true; data: GoogleCalendarSummary[] } | { success: false; error: string };

/** A pure read of whatever calendars are already persisted — never calls the Google API itself. Empty array when no account/calendars exist yet. */
export async function getMyGoogleCalendarsAction(): Promise<GetMyGoogleCalendarsResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const caller = { workspaceId: session.workspace.id, memberId: session.user.id };
  const account = await getOwnAccount(caller);
  if (!account) return { success: true, data: [] };

  const calendars = await listCalendarsForCaller(account.id, caller);
  return { success: true, data: calendars.map(toCalendarSummary) };
}

export type SyncMyGoogleCalendarEventsResult = { success: true; data: SyncGoogleCalendarEventsResult } | { success: false; error: string };

/**
 * GCAL-04 — the canonical "sync my Google Calendar events" manual
 * trigger. `workspaceId`/`memberId` derive from the authenticated
 * server session only. Deliberately the *only* event-related action
 * this checkpoint adds — no create/update/delete/RSVP action exists,
 * and no Calendar UI calls this yet (GCAL-06's own scope). The result
 * shape already carries no token/secret (see
 * `syncOwnGoogleCalendarEvents`'s own return type) — passed through
 * unmodified, matching the safe-summary discipline this file's other
 * actions already establish.
 */
export async function syncMyGoogleCalendarEventsAction(): Promise<SyncMyGoogleCalendarEventsResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await syncOwnGoogleCalendarEvents({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (result.status === "error") return { success: false, error: result.reason };
  return { success: true, data: result };
}

export type SetMyGoogleCalendarSelectedResult = { success: true; data: GoogleCalendarSummary } | { success: false; error: string };

/**
 * GC02-02 — the one member-facing mutation this checkpoint adds: toggling
 * whether one of the caller's own already-listed calendars is selected
 * (displayed on `/calendar`, eligible for event sync). Accepts only the
 * calendar's internal BloomOS id and a boolean — never a workspace/member
 * id, provider calendar id, or arbitrary patch object — and derives the
 * caller exclusively from the authenticated session, exactly like every
 * other action in this file. Any failure (the calendar doesn't exist, or
 * exists but isn't the caller's own) collapses to the same generic error
 * as every other action here, deliberately not distinguishing the two —
 * an ownership probe against an arbitrary calendar id learns nothing.
 */
export async function setMyGoogleCalendarSelectedAction(calendarId: string, selected: boolean): Promise<SetMyGoogleCalendarSelectedResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.calendar")) return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    const calendar = await updateCalendarSelection(calendarId, selected, { workspaceId: session.workspace.id, memberId: session.user.id });
    return { success: true, data: toCalendarSummary(calendar) };
  } catch {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }
}
