import { nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import { listConnections } from "@/core/integrations/integrationManager";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { GoogleCalendarApiError, getPrimaryCalendarAccountIdentity } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";
import { upsertAccount, type GoogleCalendarCallerScope } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import type { IntegrationConnection } from "@/core/integrations/types";
import type { GoogleCalendarAccount } from "@/core/integrations/googleCalendarReadonly/types";

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
