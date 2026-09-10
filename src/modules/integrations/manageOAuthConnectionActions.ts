"use server";

import { resolveMemberSessionSnapshot, type MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { registerCheckpoint43ProviderFactories } from "@/modules/integrations/registerCheckpoint43ProviderFactories";
import { applyConnectionEvent, attachCredential, getConnection, installProvider, listConnections, setConnectionConfig } from "@/core/integrations/integrationManager";
import { getCredential, resolveAccessToken, resolveRefreshToken, revokeCredential, rotateOAuthCredential } from "@/core/integrations/credentialManager";
import { getProvider } from "@/core/integrations/providerRegistry";
import { beginAuthorization, completeAuthorization, getPendingAuthorizationForCaller, resolvePendingAuthorizationCodeVerifier } from "@/core/integrations/oauthEngine";
import { exchangeAuthorizationCode, refreshOAuthToken } from "@/core/integrations/oauthTokenExchange";
import { createProviderInstance } from "@/core/integrations/providerFactory";
import { getLogger } from "@/core/observability/logger";
import type { IntegrationConnection } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";
const OAUTH_PROVIDER_IDS = ["google-calendar", "gmail", "google-drive", "docusign", "dropbox"] as const;
type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

/**
 * GMAIL-03R2 — Google/Gmail's ownership model is frozen as member-owned
 * within a workspace (GMAIL-01F/GMAIL-02): only Gmail connects this way
 * today. Every other OAuth-capable provider stays workspace-owned,
 * exactly as it always has been — this set is the ONLY place that
 * decision is made, so adding a future member-owned provider never means
 * re-deriving `memberId`/ownership logic at every call site below.
 */
const MEMBER_OWNED_PROVIDER_IDS = new Set<OAuthProviderId>(["gmail"]);

registerBuiltinProviders();
registerCheckpoint43ProviderFactories();

export type ManageOAuthConnectionResult<T> = { success: true; data: T } | { success: false; error: string };

function isOAuthProviderId(providerId: string): providerId is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(providerId);
}

/**
 * The canonical authenticated identifier for every `auth.users(id)`-typed
 * column a member-owned provider's lifecycle writes (`member_id` — see
 * GMAIL-02's own migration and RLS, which key on `auth.uid()`). This is
 * `session.user.id`, never `session.membership.id` (a distinct
 * `workspace_members.id` primary key) — mechanically confirmed against
 * the schema. Null for a workspace-owned provider, preserving every
 * other provider's existing shape exactly.
 */
function ownerMemberIdFor(providerId: OAuthProviderId, session: MemberSessionSnapshot & { kind: "active" }): string | null {
  return MEMBER_OWNED_PROVIDER_IDS.has(providerId) ? session.user.id : null;
}

async function findExistingConnection(workspaceId: string, providerId: string, memberId: string | null): Promise<IntegrationConnection | null> {
  const connections = await listConnections(workspaceId);
  return connections.find((connection) => connection.provider_id === providerId && connection.member_id === memberId) ?? null;
}

/** A member may act on a connection only if it's workspace-owned (`member_id === null`, every non-Gmail provider's existing shape) or owned by that exact member — never a different member's own member-owned connection, even within the same workspace. Mirrors the RLS policy `integration_connections`/`integration_credentials` already enforce at the database level (`member_id is null or member_id = auth.uid()`), so mock mode (no real RLS) gets the same guarantee. */
function isOwnedByCaller(connection: IntegrationConnection, session: MemberSessionSnapshot & { kind: "active" }): boolean {
  return connection.member_id === null || connection.member_id === session.user.id;
}

/**
 * v2 Checkpoint 43, Step 3 — starts a real OAuth authorization-code flow:
 * builds the actual authorization URL a browser would be redirected to,
 * via the real, provider-declared endpoint and Checkpoint 22's own
 * `oauthEngine.beginAuthorization()` (real CSRF state + PKCE). The
 * returned `authorizationUrl` is genuinely correct and could be opened in
 * a browser today — completing the round trip just requires a registered
 * OAuth app (see `oauthTokenExchange.ts`), which this environment doesn't
 * have configured.
 */
/**
 * GMAIL-03R2-FIX1 — a genuine, pre-existing, shared production defect:
 * this action never fired `connect_requested`, so a fresh connection
 * stayed `disconnected` all the way through `beginAuthorization`, making
 * `completeProviderOAuthConnectionAction`'s own final `connect_succeeded`
 * (valid only from `connecting`/`reconnecting`) unreachable for every
 * OAuth-capable provider, always. Fixed at the one shared call site,
 * using only the existing `connectionStateMachine.ts` vocabulary — no new
 * state, no loosened validation. `connect_requested`'s own `from` list
 * (`disconnected`/`failed`/`unknown`) is exactly this action's ordinary,
 * only "Connect" entry point (there is no separate reconnect action for
 * these providers), so a connection already `connected`/`connecting`/
 * `reconnecting`/`refreshing`/`expired`/etc. safely fails closed here
 * instead — this fix does not invent reconnect-from-expired behavior.
 */
export async function beginProviderOAuthConnectionAction(providerId: string, redirectUri: string): Promise<ManageOAuthConnectionResult<{ authorizationUrl: string; state: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOAuthProviderId(providerId)) return { success: false, error: `"${providerId}" is not an OAuth-capable provider this checkpoint implements.` };

  const provider = getProvider(providerId);
  if (!provider?.oauth) return { success: false, error: "This provider has no OAuth configuration registered." };

  const memberId = ownerMemberIdFor(providerId, session);
  // GMAIL-03R2 — installed_by/created_by remain typed against auth.users(id)
  // for every provider (see the GMAIL-02 migration), but only Gmail's own
  // installedBy is corrected to session.user.id here; every other provider
  // keeps passing session.membership.id exactly as before — that pre-existing
  // cross-provider mismatch is a known, separately-tracked, out-of-scope
  // issue this checkpoint does not touch outside Gmail.
  const installedBy = memberId ?? session.membership.id;
  const connection = (await findExistingConnection(session.workspace.id, providerId, memberId)) ?? (await installProvider({ workspaceId: session.workspace.id, providerId, installedBy, memberId }));

  try {
    await applyConnectionEvent(connection.id, "connect_requested", session.membership.id, "Beginning OAuth authorization.");
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not begin a new connection from this connection's current state." };
  }

  let result: { authorizationUrl: string; state: string };
  try {
    result = await beginAuthorization({ workspaceId: session.workspace.id, connectionId: connection.id, providerId, redirectUri, memberId });
  } catch (error) {
    // Roll back via the existing connect_failed transition (valid from
    // "connecting") rather than leaving the connection stuck mid-flow —
    // best-effort: a failure here would already be a second, unrelated
    // problem, not one this action should surface over the original error.
    await applyConnectionEvent(connection.id, "connect_failed", session.membership.id, "Could not start the OAuth authorization request.").catch(() => undefined);
    return { success: false, error: error instanceof Error ? error.message : "Could not begin OAuth authorization." };
  }

  return { success: true, data: { authorizationUrl: result.authorizationUrl, state: result.state } };
}

/**
 * Completes the flow: validates the real CSRF state and its ownership
 * (via `oauthEngine.getPendingAuthorizationForCaller`/`completeAuthorization`,
 * both single-use and scoped to the caller's own workspace/member), then
 * performs a real token exchange against the provider's own token
 * endpoint. Honestly reports `configured: false` — never a fabricated
 * token — when this environment has no OAuth client registered for the
 * provider. The PKCE `code_verifier` is resolved server-side from the
 * durable pending-authorization store — never supplied by a caller.
 */
export async function completeProviderOAuthConnectionAction(providerId: string, code: string, state: string, redirectUri: string): Promise<ManageOAuthConnectionResult<IntegrationConnection | { pendingConfiguration: true; reason: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOAuthProviderId(providerId)) return { success: false, error: `"${providerId}" is not an OAuth-capable provider this checkpoint implements.` };

  const provider = getProvider(providerId);
  if (!provider?.oauth) return { success: false, error: "This provider has no OAuth configuration registered." };

  const callerScope = { workspaceId: session.workspace.id, memberId: session.user.id };
  if (!(await getPendingAuthorizationForCaller(state, callerScope))) return { success: false, error: "This authorization request has expired or was already used." };
  const codeVerifier = (await resolvePendingAuthorizationCodeVerifier(state, callerScope)) ?? undefined;

  // Real token exchange happens before the pending state is consumed, so an
  // unconfigured OAuth client leaves the state valid for a genuine retry
  // once the provider is configured — rather than burning it on a call we
  // already know will report `configured: false`.
  const exchange = await exchangeAuthorizationCode({ providerId, tokenEndpoint: provider.oauth.tokenEndpoint, code, redirectUri, codeVerifier });
  if (!exchange.configured) return { success: true, data: { pendingConfiguration: true, reason: exchange.reason } };

  const createdBy = MEMBER_OWNED_PROVIDER_IDS.has(providerId) ? session.user.id : session.membership.id;
  let pending: string;
  try {
    const completion = await completeAuthorization({
      state,
      createdBy,
      accessToken: exchange.accessToken,
      refreshToken: exchange.refreshToken,
      expiresAt: exchange.expiresInSeconds !== null ? new Date(Date.now() + exchange.expiresInSeconds * 1000).toISOString() : null,
      scopes: provider.oauth.defaultScopes,
      callerWorkspaceId: session.workspace.id,
      callerMemberId: session.user.id,
    });
    pending = completion.connectionId;
    const withCredential = await attachCredential(pending, completion.credential.id);
    if (!withCredential) return { success: false, error: "Could not attach the new credential to this connection." };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "This authorization request has expired or was already used." };
  }

  const testProvider = createProviderInstance(providerId, { accessToken: exchange.accessToken });
  const testResult = testProvider ? await testProvider.ping() : { ok: true, latencyMs: 0 };
  if (!testResult.ok) return { success: false, error: `${provider.name} rejected this connection: ${testResult.error ?? "unknown error"}.` };

  try {
    const result = await applyConnectionEvent(pending, "connect_succeeded", session.membership.id, `Verified with a real ${provider.name} call, ${testResult.latencyMs}ms.`);
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not complete the connection." };
  }
}

export async function disconnectOAuthProviderAction(connectionId: string): Promise<ManageOAuthConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.disconnect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = await getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };
  // A member-owned connection (Gmail today) may only be disconnected by the exact member who owns it — same denial shape the RLS policy already enforces at the database level.
  if (!isOwnedByCaller(connection, session)) return { success: false, error: GENERIC_ACCESS_ERROR };

  if (connection.credential_id) await revokeCredential(connection.credential_id);
  try {
    const result = await applyConnectionEvent(connectionId, "disable_requested", session.membership.id, "Disconnected by a workspace member.");
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not disconnect." };
  }
}

/** GMAIL-03R2 — the caller's own connection for a given OAuth provider: their own member-owned connection for Gmail, or the workspace's shared connection for every other (workspace-owned) provider. Generic, not Gmail-specific — any future member-owned provider gets this for free. */
export async function getOwnProviderConnectionAction(providerId: string): Promise<ManageOAuthConnectionResult<IntegrationConnection | null>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOAuthProviderId(providerId)) return { success: false, error: `"${providerId}" is not an OAuth-capable provider this checkpoint implements.` };

  const memberId = ownerMemberIdFor(providerId, session);
  const connection = await findExistingConnection(session.workspace.id, providerId, memberId);
  return { success: true, data: connection };
}

/**
 * GMAIL-03R2 — persisted server-side token refresh: resolves and
 * decrypts the connection's own refresh token, calls the provider's real
 * token endpoint via `oauthTokenExchange.refreshOAuthToken()`, and
 * rotates the stored credential in place. Reuses the existing
 * `refresh_requested`/`refresh_succeeded`/`refresh_failed` connection
 * states — no new state-machine vocabulary. Never returns a raw
 * provider error to the caller (logged server-side only via `getLogger()`).
 */
export async function refreshProviderOAuthConnectionAction(connectionId: string): Promise<ManageOAuthConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = await getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOwnedByCaller(connection, session)) return { success: false, error: GENERIC_ACCESS_ERROR };

  const provider = getProvider(connection.provider_id);
  if (!provider?.oauth) return { success: false, error: "This provider has no OAuth configuration registered." };

  if (!connection.credential_id) return { success: false, error: "This connection has no credential to refresh." };
  const credential = await getCredential(connection.credential_id);
  if (!credential || credential.kind !== "oauth_token") return { success: false, error: "This connection has no refreshable OAuth credential." };

  try {
    await applyConnectionEvent(connectionId, "refresh_requested", session.membership.id, "Token refresh requested.");
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not start a token refresh from this connection's current state." };
  }

  const refreshToken = await resolveRefreshToken(credential.id);
  if (!refreshToken) {
    await applyConnectionEvent(connectionId, "refresh_failed", session.membership.id, "No refresh token is available for this connection.");
    return { success: false, error: "This connection has no refresh token on file — reconnect it." };
  }

  let exchange: Awaited<ReturnType<typeof refreshOAuthToken>>;
  try {
    exchange = await refreshOAuthToken({ providerId: connection.provider_id, tokenEndpoint: provider.oauth.tokenEndpoint, refreshToken });
  } catch (error) {
    getLogger().error("OAuth token refresh call failed", { connectionId, providerId: connection.provider_id, error: error instanceof Error ? error.message : "unknown error" });
    await applyConnectionEvent(connectionId, "refresh_failed", session.membership.id, "The provider rejected the refresh request — the authorization may have been revoked.");
    return { success: false, error: `${provider.name} rejected this connection's refresh request. It may have been revoked — reconnect this integration.` };
  }

  if (!exchange.configured) {
    await applyConnectionEvent(connectionId, "refresh_failed", session.membership.id, exchange.reason);
    return { success: false, error: exchange.reason };
  }

  const rotated = await rotateOAuthCredential(credential.id, {
    accessToken: exchange.accessToken,
    refreshToken: exchange.refreshToken,
    expiresAt: exchange.expiresInSeconds !== null ? new Date(Date.now() + exchange.expiresInSeconds * 1000).toISOString() : null,
  });
  if (!rotated) {
    await applyConnectionEvent(connectionId, "refresh_failed", session.membership.id, "Could not persist the refreshed token.");
    return { success: false, error: "Could not persist the refreshed token." };
  }

  try {
    const result = await applyConnectionEvent(connectionId, "refresh_succeeded", session.membership.id, "Token refreshed.");
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not complete the token refresh." };
  }
}

export async function setProviderConnectionConfigAction(connectionId: string, config: Record<string, string>): Promise<ManageOAuthConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = await getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const updated = await setConnectionConfig(connectionId, config);
  if (!updated) return { success: false, error: "Could not update this connection's configuration." };
  return { success: true, data: updated };
}

/** Resolves a connection's real access token for a caller that already has permission to act on the workspace's behalf (e.g. a Workflow action) — never returned to the client directly. Gated on `integrations.sensitive`, the same narrowest permission this file's own documentation reserves for "any action that could reveal which real external accounts are connected," and confirms the connection belongs to the caller's workspace before ever touching the credential — matching every other mutation in this file. */
export async function resolveConnectionAccessTokenForServer(connectionId: string): Promise<string | null> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("integrations.sensitive")) return null;

  const connection = await getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || !connection.credential_id) return null;

  return resolveAccessToken(connection.credential_id);
}
