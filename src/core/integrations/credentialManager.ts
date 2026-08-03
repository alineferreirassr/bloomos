import { generateApiKeySecret, hashApiKeySecret, displayPrefix } from "@/lib/api/apiKeyToken";
import { nowIso } from "@/lib/data/utils";
import {
  generateCredentialId,
  getCredentialByConnectionId,
  getCredentialById,
  insertCredential,
  listCredentialsForWorkspace,
  updateCredential,
} from "@/lib/data/core/integrations/credentialStore";
import type { CredentialKind, IntegrationCredential } from "@/core/integrations/types";

/**
 * The Credentials Manager (v2 Checkpoint 22, Step 4) — never persists a
 * plaintext secret or token, mirroring `lib/api/apiKeyToken.ts`'s own
 * discipline exactly for `api_key`-kind credentials: only a SHA-256
 * `key_hash` and a short, non-reversible `key_prefix` are stored, and the
 * real secret is returned to the caller exactly once (at issue/rotation
 * time).
 *
 * `oauth_token`-kind credentials have no plaintext precedent in this
 * codebase to mirror (no prior checkpoint ever stored a third-party
 * token), so this introduces `EncryptionProvider` — a seam a future
 * checkpoint would point at a real KMS/Vault. Its own default
 * implementation, `InMemoryEncryptionProvider`, is an honest mock: it
 * does not actually encrypt, it just keeps the value out of the
 * `IntegrationCredential` record itself, behind an opaque `secretRef`.
 * This checkpoint never calls a real OAuth handshake (the spec's own
 * stop condition), so no real token ever flows through this provider —
 * it exists so the shape is correct for when one does.
 */
export interface EncryptionProvider {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ref: string): Promise<string | null>;
}

/** Mock-only — holds the "encrypted" value in-process, keyed by an opaque ref. Never a real encryption algorithm; a future checkpoint replaces this with a real KMS/Vault-backed provider without changing this file's own public API. */
export class InMemoryEncryptionProvider implements EncryptionProvider {
  private readonly store = new Map<string, string>();

  async encrypt(plaintext: string): Promise<string> {
    const ref = `secretref_${crypto.randomUUID()}`;
    this.store.set(ref, plaintext);
    return ref;
  }

  async decrypt(ref: string): Promise<string | null> {
    return this.store.get(ref) ?? null;
  }

  reset(): void {
    this.store.clear();
  }
}

let encryptionProvider: EncryptionProvider = new InMemoryEncryptionProvider();

/** Test/future-checkpoint seam — swap in a real provider without touching any caller. */
export function setEncryptionProvider(provider: EncryptionProvider): void {
  encryptionProvider = provider;
}

export function resetEncryptionProvider(): void {
  encryptionProvider = new InMemoryEncryptionProvider();
}

export interface IssueApiKeyCredentialParams {
  workspaceId: string;
  connectionId: string;
  scopes: string[];
  createdBy: string;
}

export interface IssuedApiKeyCredential {
  credential: IntegrationCredential;
  /** Shown to the caller exactly once — never persisted, never retrievable again. */
  secret: string;
}

function baseCredential(kind: CredentialKind, params: { workspaceId: string; connectionId: string; scopes: string[]; createdBy: string }): Omit<IntegrationCredential, "id" | "key_hash" | "key_prefix" | "access_token_ref" | "refresh_token_ref"> {
  const now = nowIso();
  return {
    workspace_id: params.workspaceId,
    connection_id: params.connectionId,
    kind,
    scopes: params.scopes,
    expires_at: null,
    rotated_at: null,
    revoked_at: null,
    created_by: params.createdBy,
    created_at: now,
    updated_at: now,
  };
}

export async function issueApiKeyCredential(params: IssueApiKeyCredentialParams): Promise<IssuedApiKeyCredential> {
  const secret = generateApiKeySecret();
  const credential: IntegrationCredential = {
    id: generateCredentialId(),
    ...baseCredential("api_key", params),
    key_hash: await hashApiKeySecret(secret),
    key_prefix: displayPrefix(secret),
    access_token_ref: null,
    refresh_token_ref: null,
  };
  return { credential: insertCredential(credential), secret };
}

export interface IssueOAuthCredentialParams {
  workspaceId: string;
  connectionId: string;
  scopes: string[];
  createdBy: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

/** Never called with a real third-party token this checkpoint — the OAuth Engine's own "no real handshake" scope means every caller today only exercises this with a synthetic/test value. */
export async function issueOAuthCredential(params: IssueOAuthCredentialParams): Promise<IntegrationCredential> {
  const accessTokenRef = await encryptionProvider.encrypt(params.accessToken);
  const refreshTokenRef = params.refreshToken ? await encryptionProvider.encrypt(params.refreshToken) : null;
  const credential: IntegrationCredential = {
    id: generateCredentialId(),
    ...baseCredential("oauth_token", params),
    expires_at: params.expiresAt ?? null,
    key_hash: null,
    key_prefix: null,
    access_token_ref: accessTokenRef,
    refresh_token_ref: refreshTokenRef,
  };
  return insertCredential(credential);
}

/** Resolves the real access token for an `oauth_token`-kind credential. Never used for `api_key`-kind credentials — those are only ever verified by hash (`verifyApiKeySecret`), never read back. */
export async function resolveAccessToken(credentialId: string): Promise<string | null> {
  const credential = getCredentialById(credentialId);
  if (!credential || credential.kind !== "oauth_token" || !credential.access_token_ref || credential.revoked_at) return null;
  return encryptionProvider.decrypt(credential.access_token_ref);
}

export interface IssueProviderSecretCredentialParams {
  workspaceId: string;
  connectionId: string;
  createdBy: string;
  /** The real secret the workspace pasted in (e.g. a Stripe `sk_test_...`/`sk_live_...` key) — encrypted immediately via `EncryptionProvider`, never persisted in plaintext. */
  secret: string;
}

/** v2 Checkpoint 23 — issues a `provider_secret`-kind credential for a static, workspace-supplied third-party secret. Reuses the exact same `EncryptionProvider` storage `issueOAuthCredential` already established — never a new plaintext column. */
export async function issueProviderSecretCredential(params: IssueProviderSecretCredentialParams): Promise<IntegrationCredential> {
  const accessTokenRef = await encryptionProvider.encrypt(params.secret);
  const credential: IntegrationCredential = {
    id: generateCredentialId(),
    ...baseCredential("provider_secret", { workspaceId: params.workspaceId, connectionId: params.connectionId, scopes: [], createdBy: params.createdBy }),
    key_hash: null,
    key_prefix: null,
    access_token_ref: accessTokenRef,
    refresh_token_ref: null,
  };
  return insertCredential(credential);
}

/** Resolves the real secret for a `provider_secret`-kind credential — the one place a real outbound call to a real provider's API is allowed to read the actual value. Never logged, never returned to the client. */
export async function resolveProviderSecret(credentialId: string): Promise<string | null> {
  const credential = getCredentialById(credentialId);
  if (!credential || credential.kind !== "provider_secret" || !credential.access_token_ref || credential.revoked_at) return null;
  return encryptionProvider.decrypt(credential.access_token_ref);
}

/** Hashes the presented secret and compares against the stored hash — the same "never compare/store plaintext" discipline `apiKeyToken.ts`'s own callers already use for the Public API. */
export async function verifyApiKeySecret(connectionId: string, presentedSecret: string): Promise<boolean> {
  const credential = getCredentialByConnectionId(connectionId);
  if (!credential || credential.kind !== "api_key" || !credential.key_hash || credential.revoked_at) return false;
  const presentedHash = await hashApiKeySecret(presentedSecret);
  return presentedHash === credential.key_hash;
}

/** Issues a brand-new secret/token and marks the old one rotated — the same "old value stops verifying immediately, history isn't lost" precedent `rotateWebhookEndpointSecret` already established. */
export async function rotateApiKeyCredential(credentialId: string): Promise<IssuedApiKeyCredential | null> {
  const existing = getCredentialById(credentialId);
  if (!existing || existing.kind !== "api_key") return null;
  const secret = generateApiKeySecret();
  const updated = updateCredential(credentialId, {
    key_hash: await hashApiKeySecret(secret),
    key_prefix: displayPrefix(secret),
    rotated_at: nowIso(),
  });
  if (!updated) return null;
  return { credential: updated, secret };
}

/** Replaces a `provider_secret`-kind credential's own encrypted value in place — e.g. a workspace rotating a leaked Stripe key or swapping sandbox for a production key. Same id, so anything already pointing at `credential_id` (the `IntegrationConnection`) keeps working. */
export async function rotateProviderSecretCredential(credentialId: string, newSecret: string): Promise<IntegrationCredential | null> {
  const existing = getCredentialById(credentialId);
  if (!existing || existing.kind !== "provider_secret") return null;
  const accessTokenRef = await encryptionProvider.encrypt(newSecret);
  return updateCredential(credentialId, { access_token_ref: accessTokenRef, rotated_at: nowIso() });
}

export function revokeCredential(credentialId: string): IntegrationCredential | null {
  return updateCredential(credentialId, { revoked_at: nowIso() });
}

export function getCredential(credentialId: string): IntegrationCredential | null {
  return getCredentialById(credentialId);
}

export function getCredentialForConnection(connectionId: string): IntegrationCredential | null {
  return getCredentialByConnectionId(connectionId);
}

export function listCredentials(workspaceId: string): IntegrationCredential[] {
  return listCredentialsForWorkspace(workspaceId);
}
