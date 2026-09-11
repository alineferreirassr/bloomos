import { getProvider } from "@/core/integrations/providerRegistry";
import { issueOAuthCredential, InMemoryEncryptionProvider, type EncryptionProvider } from "@/core/integrations/credentialManager";
import { SupabasePendingOAuthVaultProvider } from "@/core/integrations/pendingAuthorizationVaultProvider";
import { resolveOAuthClientCredentials } from "@/core/integrations/oauthTokenExchange";
import { getDataMode } from "@/lib/data/provider";
import {
  deletePendingAuthorization,
  getPendingAuthorizationByState,
  insertPendingAuthorization,
  listPendingAuthorizationsForWorkspace as listPendingAuthorizationRowsForWorkspace,
  resetPendingOAuthAuthorizationStore,
  type PendingOAuthAuthorizationRow,
} from "@/lib/data/core/integrations/pendingOAuthAuthorizationStore";
import type { IntegrationCredential } from "@/core/integrations/types";

/**
 * The generic OAuth Engine (v2 Checkpoint 22, Step 6) — the one handshake
 * *shape* every future OAuth-capable provider would use, built entirely
 * from `ProviderDefinition.oauth` metadata so no provider-specific code
 * lives here. This engine never makes a real HTTP call itself: it never
 * redirects a browser to a real `authorizationEndpoint`, never POSTs to a
 * real `tokenEndpoint` (that's `oauthTokenExchange.ts`, called by
 * `manageOAuthConnectionActions.ts` before `completeAuthorization`).
 * What it does do — generate a real CSRF `state`, a real PKCE
 * verifier/challenge pair (`crypto.subtle`), build the exact
 * authorization URL a browser *would* be sent to, and durably track a
 * pending authorization request until it's completed, cancelled, or
 * expires — is the bookkeeping a real handshake needs regardless of
 * which provider it's for.
 *
 * GMAIL-03P — the pending-authorization bookkeeping is now backed by
 * `pendingOAuthAuthorizationStore.ts` (mock in-memory / real Supabase via
 * `selectRepository`), not a module-scope array. A real OAuth round trip
 * is two separate HTTP requests (authorization start, then the
 * provider's callback, seconds to minutes apart) with no guarantee of
 * hitting the same serverless instance — module memory cannot survive
 * that gap in production. The PKCE `code_verifier` itself is encrypted
 * through the same `EncryptionProvider` seam `credentialManager.ts`
 * established (mock mode: `InMemoryEncryptionProvider`; Supabase mode:
 * `SupabasePendingOAuthVaultProvider`) before it's ever persisted — this
 * engine's own `PendingAuthorization` type never carries the plaintext.
 */

const PENDING_TTL_MS = 10 * 60 * 1000;

export interface PendingAuthorization {
  state: string;
  provider_id: string;
  connection_id: string;
  workspace_id: string;
  member_id: string | null;
  redirect_uri: string;
  created_at: string;
  expires_at: string;
}

function defaultPendingSecretProvider(): EncryptionProvider {
  return getDataMode() === "supabase" ? new SupabasePendingOAuthVaultProvider() : new InMemoryEncryptionProvider();
}

let pendingSecretProvider: EncryptionProvider = defaultPendingSecretProvider();

/** Test/future-checkpoint seam — swap in a real provider without touching any caller, mirroring `credentialManager.ts`'s own `setEncryptionProvider`. */
export function setPendingSecretProvider(provider: EncryptionProvider): void {
  pendingSecretProvider = provider;
}

export function resetOAuthEngine(): void {
  resetPendingOAuthAuthorizationStore();
  pendingSecretProvider = defaultPendingSecretProvider();
}

function toPublicPendingAuthorization(row: PendingOAuthAuthorizationRow): PendingAuthorization {
  return {
    state: row.state,
    provider_id: row.provider_id,
    connection_id: row.connection_id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    redirect_uri: row.redirect_uri,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

function isExpired(row: PendingOAuthAuthorizationRow): boolean {
  return new Date(row.expires_at).getTime() < Date.now();
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
  /** GMAIL-03P addendum — null (the default) records a workspace-owned pending attempt, matching every provider's existing shape. Substrate-only: no caller passes this yet — Gmail's own member-owned wiring is GMAIL-03's, not this checkpoint's. */
  memberId?: string | null;
}

export interface BeginAuthorizationResult {
  authorizationUrl: string;
  state: string;
}

/**
 * Builds the exact URL a real handshake would redirect the browser to —
 * never fetched or navigated to by this engine itself. Throws if the
 * provider isn't registered, doesn't declare `oauth` metadata, or has no
 * OAuth client configured in this environment, since there's nothing to
 * build a real authorization URL from in any of those cases.
 *
 * GMAIL-OAUTH-FIX-01 — `client_id` is a mandatory parameter on every real
 * OAuth 2.0 authorization-code request (Google's own authorization
 * endpoint rejects its absence with "Missing required parameter:
 * client_id", confirmed live); this resolves it via the same
 * `resolveOAuthClientCredentials()` `oauthTokenExchange.ts` already uses
 * for token exchange, so every OAuth-capable provider registered through
 * that one shared map is fixed identically — never a per-provider special
 * case. Checked before any pending-authorization work below, so a missing
 * client never leaves behind an orphaned pending-authorization row (or a
 * Vault secret) for a request that could never complete anyway.
 * `client_secret` is resolved by that same call but deliberately never
 * read here — it has no place in a public authorization-request URL.
 */
export async function beginAuthorization(params: BeginAuthorizationParams): Promise<BeginAuthorizationResult> {
  const provider = getProvider(params.providerId);
  if (!provider) throw new Error(`No provider is registered for "${params.providerId}".`);
  if (!provider.capabilities.includes("oauth") || !provider.oauth) throw new Error(`Provider "${params.providerId}" does not declare OAuth support.`);

  const credentials = resolveOAuthClientCredentials(params.providerId);
  if (!credentials) throw new Error(`No OAuth client is configured for "${params.providerId}" in this environment.`);

  const state = generateOAuthState();
  const pkce = provider.oauth.supportsPkce ? await generatePkcePair() : null;
  const now = Date.now();
  const codeVerifierRef = pkce ? await pendingSecretProvider.encrypt(pkce.codeVerifier) : null;

  await insertPendingAuthorization({
    state,
    provider_id: params.providerId,
    connection_id: params.connectionId,
    workspace_id: params.workspaceId,
    member_id: params.memberId ?? null,
    redirect_uri: params.redirectUri,
    code_verifier_ref: codeVerifierRef,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + PENDING_TTL_MS).toISOString(),
  });

  const url = new URL(provider.oauth.authorizationEndpoint);
  url.searchParams.set("client_id", credentials.clientId);
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

/** Never exposes `code_verifier_ref` — the raw row's one secret-bearing field — matching `IntegrationCredential`'s own "never return the ref through an ordinary read" shape. Lazily deletes an expired row on read rather than waiting for a background sweep, since this checkpoint adds no cron job. */
export async function getPendingAuthorization(state: string): Promise<PendingAuthorization | null> {
  const row = await getPendingAuthorizationByState(state);
  if (!row) return null;
  if (isExpired(row)) {
    await deletePendingAuthorization(state);
    return null;
  }
  return toPublicPendingAuthorization(row);
}

/**
 * An additive, opt-in ownership-scoped accessor alongside
 * `getPendingAuthorization`. In Supabase mode this is defense-in-depth
 * (the table's own RLS policy already denies a cross-workspace or
 * cross-member read at the database level); in mock mode, where there is
 * no RLS, this is the enforcement — matching this codebase's existing
 * "ownership checked by the caller, not the mock store" pattern (e.g.
 * `resolveConnectionAccessTokenForServer`). GMAIL-03R2 wires this into
 * `manageOAuthConnectionActions.ts`'s `completeProviderOAuthConnectionAction`.
 */
export async function getPendingAuthorizationForCaller(state: string, caller: { workspaceId: string; memberId?: string | null }): Promise<PendingAuthorization | null> {
  const pending = await getPendingAuthorization(state);
  if (!pending) return null;
  if (pending.workspace_id !== caller.workspaceId) return null;
  if (pending.member_id !== null && pending.member_id !== (caller.memberId ?? null)) return null;
  return pending;
}

/** GMAIL-03R2 — the one legitimate way to recover a pending authorization's plaintext PKCE `code_verifier`: server-side only, never through a client-supplied param (there is no external caller that could supply one — a real callback route resolves it here). Returns null for a provider that didn't use PKCE, an unknown/expired state, or an ownership mismatch when `caller` is supplied. */
export async function resolvePendingAuthorizationCodeVerifier(state: string, caller?: { workspaceId: string; memberId?: string | null }): Promise<string | null> {
  const row = await getPendingAuthorizationByState(state);
  if (!row || isExpired(row)) return null;
  if (caller) {
    if (row.workspace_id !== caller.workspaceId) return null;
    if (row.member_id !== null && row.member_id !== (caller.memberId ?? null)) return null;
  }
  if (!row.code_verifier_ref) return null;
  return pendingSecretProvider.decrypt(row.code_verifier_ref);
}

export interface CompleteAuthorizationParams {
  state: string;
  createdBy: string;
  /** The token values a real callback route would already hold, exchanged from the provider's own `tokenEndpoint` — never produced by this engine. */
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scopes?: string[];
  /** GMAIL-03R2 addendum — when supplied, enforces the same ownership scope as `getPendingAuthorizationForCaller` before consuming the row, using the exact same "no pending authorization" message on a mismatch as on a genuinely missing state (never distinguishing "exists but isn't yours" from "doesn't exist"). Optional so every existing caller/test keeps its current behavior. */
  callerWorkspaceId?: string;
  callerMemberId?: string | null;
}

export interface OAuthCompletionResult {
  credential: IntegrationCredential;
  connectionId: string;
  providerId: string;
}

/**
 * Consumes a pending authorization exactly once — a replayed or expired
 * `state` throws, the same CSRF discipline a real callback route needs
 * regardless of provider. The row is deleted before the credential is
 * issued, matching the prior in-memory implementation's own ordering —
 * a failure issuing the credential does not resurrect a consumed state.
 * The issued credential's own `member_id` mirrors the pending row's
 * `member_id` exactly, so a member-owned connection's credential is
 * member-owned too.
 *
 * GMAIL-03R2 — an ownership mismatch (`callerWorkspaceId`/`callerMemberId`
 * supplied but not matching) throws *without* deleting the row: a wrong
 * caller must never be able to destroy someone else's still-valid,
 * in-progress authorization just by guessing/observing its `state` and
 * calling complete with the wrong identity. Only a genuinely expired row
 * is lazily removed here.
 */
export async function completeAuthorization(params: CompleteAuthorizationParams): Promise<OAuthCompletionResult> {
  const row = await getPendingAuthorizationByState(params.state);
  if (row && isExpired(row)) await deletePendingAuthorization(params.state);
  const usableRow = row && !isExpired(row) ? row : null;

  const ownershipMismatch =
    usableRow !== null &&
    params.callerWorkspaceId !== undefined &&
    (usableRow.workspace_id !== params.callerWorkspaceId || (usableRow.member_id !== null && usableRow.member_id !== (params.callerMemberId ?? null)));

  if (!usableRow || ownershipMismatch) {
    throw new Error("No pending authorization for this state — it may have expired or already been completed.");
  }

  await deletePendingAuthorization(params.state);

  const credential = await issueOAuthCredential({
    workspaceId: usableRow.workspace_id,
    connectionId: usableRow.connection_id,
    scopes: params.scopes ?? [],
    createdBy: params.createdBy,
    memberId: usableRow.member_id,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    expiresAt: params.expiresAt,
  });

  return { credential, connectionId: usableRow.connection_id, providerId: usableRow.provider_id };
}

/** Discards a pending authorization without completing it — e.g. the user cancelled at the provider's own consent screen. */
export async function cancelAuthorization(state: string): Promise<void> {
  await deletePendingAuthorization(state);
}

/** Also lazily sweeps any expired row it encounters — the minimum safe cleanup this checkpoint adds in place of a background job. */
export async function listPendingAuthorizationsForWorkspace(workspaceId: string): Promise<PendingAuthorization[]> {
  const rows = await listPendingAuthorizationRowsForWorkspace(workspaceId);
  const valid: PendingAuthorization[] = [];
  for (const row of rows) {
    if (isExpired(row)) {
      await deletePendingAuthorization(row.state);
      continue;
    }
    valid.push(toPublicPendingAuthorization(row));
  }
  return valid;
}
