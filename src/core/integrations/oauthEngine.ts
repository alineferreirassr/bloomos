import { getProvider } from "@/core/integrations/providerRegistry";
import { issueOAuthCredential } from "@/core/integrations/credentialManager";
import type { IntegrationCredential } from "@/core/integrations/types";

/**
 * The generic OAuth Engine (v2 Checkpoint 22, Step 6) — the one handshake
 * *shape* every future OAuth-capable provider would use, built entirely
 * from `ProviderDefinition.oauth` metadata so no provider-specific code
 * lives here. Per this checkpoint's own explicit stop condition, this
 * engine never makes a real HTTP call: it never redirects a browser to a
 * real `authorizationEndpoint`, never POSTs to a real `tokenEndpoint`.
 * What it does do — generate a real CSRF `state`, a real PKCE
 * verifier/challenge pair (`crypto.subtle`), build the exact
 * authorization URL a browser *would* be sent to, and track a pending
 * authorization request until it's completed or expires — is the
 * bookkeeping a real handshake needs regardless of which provider it's
 * for. `completeAuthorization` accepts the token values a real callback
 * route would have already received from the provider (this checkpoint
 * never produces or fetches one), and does only the local bookkeeping:
 * validate the pending request, mint an `IntegrationCredential` via
 * `credentialManager.ts`, and report the connection state transition a
 * caller should apply.
 */

const PENDING_TTL_MS = 10 * 60 * 1000;

export interface PendingAuthorization {
  state: string;
  provider_id: string;
  connection_id: string;
  workspace_id: string;
  redirect_uri: string;
  code_verifier: string | null;
  created_at: string;
  expires_at: string;
}

let pendingAuthorizations: PendingAuthorization[] = [];

export function resetOAuthEngine(): void {
  pendingAuthorizations = [];
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateOAuthState(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** RFC 7636 `S256` — the only method every OAuth 2.0 provider that supports PKCE at all also supports, so this engine never bothers offering the weaker `plain` method. */
export async function generatePkcePair(): Promise<PkcePair> {
  const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = toBase64Url(new Uint8Array(digest));
  return { codeVerifier, codeChallenge };
}

export interface BeginAuthorizationParams {
  workspaceId: string;
  connectionId: string;
  providerId: string;
  redirectUri: string;
}

export interface BeginAuthorizationResult {
  authorizationUrl: string;
  state: string;
}

/** Builds the exact URL a real handshake would redirect the browser to — never fetched or navigated to by this engine itself. Throws if the provider isn't registered or doesn't declare `oauth` metadata, since there's nothing to build a URL from. */
export async function beginAuthorization(params: BeginAuthorizationParams): Promise<BeginAuthorizationResult> {
  const provider = getProvider(params.providerId);
  if (!provider) throw new Error(`No provider is registered for "${params.providerId}".`);
  if (!provider.capabilities.includes("oauth") || !provider.oauth) throw new Error(`Provider "${params.providerId}" does not declare OAuth support.`);

  const state = generateOAuthState();
  const pkce = provider.oauth.supportsPkce ? await generatePkcePair() : null;
  const now = Date.now();

  pendingAuthorizations = [
    ...pendingAuthorizations,
    {
      state,
      provider_id: params.providerId,
      connection_id: params.connectionId,
      workspace_id: params.workspaceId,
      redirect_uri: params.redirectUri,
      code_verifier: pkce?.codeVerifier ?? null,
      created_at: new Date(now).toISOString(),
      expires_at: new Date(now + PENDING_TTL_MS).toISOString(),
    },
  ];

  const url = new URL(provider.oauth.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", state);
  if (provider.oauth.defaultScopes.length > 0) url.searchParams.set("scope", provider.oauth.defaultScopes.join(" "));
  if (pkce) {
    url.searchParams.set("code_challenge", pkce.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return { authorizationUrl: url.toString(), state };
}

export function getPendingAuthorization(state: string): PendingAuthorization | null {
  const pending = pendingAuthorizations.find((entry) => entry.state === state);
  if (!pending) return null;
  if (new Date(pending.expires_at).getTime() < Date.now()) return null;
  return pending;
}

export interface CompleteAuthorizationParams {
  state: string;
  createdBy: string;
  /** The token values a real callback route would already hold, exchanged from the provider's own `tokenEndpoint` — never produced by this engine. */
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes?: string[];
}

export interface OAuthCompletionResult {
  credential: IntegrationCredential;
  connectionId: string;
  providerId: string;
}

/** Consumes a pending authorization exactly once — a replayed or expired `state` throws, the same CSRF discipline a real callback route needs regardless of provider. */
export async function completeAuthorization(params: CompleteAuthorizationParams): Promise<OAuthCompletionResult> {
  const pending = getPendingAuthorization(params.state);
  if (!pending) throw new Error("No pending authorization for this state — it may have expired or already been completed.");

  pendingAuthorizations = pendingAuthorizations.filter((entry) => entry.state !== params.state);

  const credential = await issueOAuthCredential({
    workspaceId: pending.workspace_id,
    connectionId: pending.connection_id,
    scopes: params.scopes ?? [],
    createdBy: params.createdBy,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresAt: params.expiresAt,
  });

  return { credential, connectionId: pending.connection_id, providerId: pending.provider_id };
}

/** Discards a pending authorization without completing it — e.g. the user cancelled at the provider's own consent screen. */
export function cancelAuthorization(state: string): void {
  pendingAuthorizations = pendingAuthorizations.filter((entry) => entry.state !== state);
}

export function listPendingAuthorizationsForWorkspace(workspaceId: string): PendingAuthorization[] {
  return pendingAuthorizations.filter((entry) => entry.workspace_id === workspaceId && new Date(entry.expires_at).getTime() >= Date.now());
}
