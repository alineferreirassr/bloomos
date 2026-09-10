"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { identifyOwnGoogleCalendarAccount } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";
import { getOwnAccount } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import type { IdentifyGoogleCalendarAccountResult } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";

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
