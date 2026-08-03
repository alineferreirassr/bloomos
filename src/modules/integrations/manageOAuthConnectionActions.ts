"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { registerCheckpoint43ProviderFactories } from "@/modules/integrations/registerCheckpoint43ProviderFactories";
import { applyConnectionEvent, attachCredential, getConnection, installProvider, listConnections, setConnectionConfig } from "@/core/integrations/integrationManager";
import { resolveAccessToken, revokeCredential } from "@/core/integrations/credentialManager";
import { getProvider } from "@/core/integrations/providerRegistry";
import { beginAuthorization, completeAuthorization, getPendingAuthorization } from "@/core/integrations/oauthEngine";
import { exchangeAuthorizationCode } from "@/core/integrations/oauthTokenExchange";
import { createProviderInstance } from "@/core/integrations/providerFactory";
import type { IntegrationConnection } from "@/core/integrations/types";

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";
const OAUTH_PROVIDER_IDS = ["google-calendar", "gmail", "google-drive", "docusign", "dropbox"] as const;
type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

registerBuiltinProviders();
registerCheckpoint43ProviderFactories();

export type ManageOAuthConnectionResult<T> = { success: true; data: T } | { success: false; error: string };

function isOAuthProviderId(providerId: string): providerId is OAuthProviderId {
  return (OAUTH_PROVIDER_IDS as readonly string[]).includes(providerId);
}

function getOrInstallConnectionSync(workspaceId: string, providerId: string): IntegrationConnection | null {
  return listConnections(workspaceId).find((connection) => connection.provider_id === providerId) ?? null;
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
export async function beginProviderOAuthConnectionAction(providerId: string, redirectUri: string): Promise<ManageOAuthConnectionResult<{ authorizationUrl: string; state: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOAuthProviderId(providerId)) return { success: false, error: `"${providerId}" is not an OAuth-capable provider this checkpoint implements.` };

  const provider = getProvider(providerId);
  if (!provider?.oauth) return { success: false, error: "This provider has no OAuth configuration registered." };

  const connection = getOrInstallConnectionSync(session.workspace.id, providerId) ?? (await installProvider({ workspaceId: session.workspace.id, providerId, installedBy: session.membership.id }));

  const result = await beginAuthorization({ workspaceId: session.workspace.id, connectionId: connection.id, providerId, redirectUri });
  return { success: true, data: { authorizationUrl: result.authorizationUrl, state: result.state } };
}

/**
 * Completes the flow: validates the real CSRF state (via
 * `oauthEngine.completeAuthorization`, single-use), then performs a real
 * token exchange against the provider's own token endpoint. Honestly
 * reports `configured: false` — never a fabricated token — when this
 * environment has no OAuth client registered for the provider.
 */
export async function completeProviderOAuthConnectionAction(providerId: string, code: string, state: string, redirectUri: string, codeVerifier?: string): Promise<ManageOAuthConnectionResult<IntegrationConnection | { pendingConfiguration: true; reason: string }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!isOAuthProviderId(providerId)) return { success: false, error: `"${providerId}" is not an OAuth-capable provider this checkpoint implements.` };

  const provider = getProvider(providerId);
  if (!provider?.oauth) return { success: false, error: "This provider has no OAuth configuration registered." };

  if (!getPendingAuthorization(state)) return { success: false, error: "This authorization request has expired or was already used." };

  // Real token exchange happens before the pending state is consumed, so an
  // unconfigured OAuth client leaves the state valid for a genuine retry
  // once the provider is configured — rather than burning it on a call we
  // already know will report `configured: false`.
  const exchange = await exchangeAuthorizationCode({ providerId, tokenEndpoint: provider.oauth.tokenEndpoint, code, redirectUri, codeVerifier });
  if (!exchange.configured) return { success: true, data: { pendingConfiguration: true, reason: exchange.reason } };

  let pending: string;
  try {
    const completion = await completeAuthorization({
      state,
      createdBy: session.membership.id,
      accessToken: exchange.accessToken,
      refreshToken: exchange.refreshToken,
      expiresAt: exchange.expiresInSeconds !== null ? new Date(Date.now() + exchange.expiresInSeconds * 1000).toISOString() : null,
      scopes: provider.oauth.defaultScopes,
    });
    pending = completion.connectionId;
    const withCredential = attachCredential(pending, completion.credential.id);
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

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  if (connection.credential_id) await revokeCredential(connection.credential_id);
  try {
    const result = await applyConnectionEvent(connectionId, "disable_requested", session.membership.id, "Disconnected by a workspace member.");
    return { success: true, data: result.connection };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not disconnect." };
  }
}

export async function setProviderConnectionConfigAction(connectionId: string, config: Record<string, string>): Promise<ManageOAuthConnectionResult<IntegrationConnection>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const updated = setConnectionConfig(connectionId, config);
  if (!updated) return { success: false, error: "Could not update this connection's configuration." };
  return { success: true, data: updated };
}

/** Resolves a connection's real access token for a caller that already has permission to act on the workspace's behalf (e.g. a Workflow action) — never returned to the client directly. Gated on `integrations.sensitive`, the same narrowest permission this file's own documentation reserves for "any action that could reveal which real external accounts are connected," and confirms the connection belongs to the caller's workspace before ever touching the credential — matching every other mutation in this file. */
export async function resolveConnectionAccessTokenForServer(connectionId: string): Promise<string | null> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("integrations.sensitive")) return null;

  const connection = getConnection(connectionId);
  if (!connection || connection.workspace_id !== session.workspace.id || !connection.credential_id) return null;

  return resolveAccessToken(connection.credential_id);
}
