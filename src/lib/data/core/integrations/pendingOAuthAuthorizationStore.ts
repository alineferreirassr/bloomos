import { selectRepository } from "@/lib/data/provider";
import * as supabasePendingOAuthAuthorizationStore from "@/lib/data/core/integrations/supabasePendingOAuthAuthorizationStore";

/**
 * The Pending OAuth Authorization store (GMAIL-03P) — the durable
 * counterpart to `connectionStore.ts`/`credentialStore.ts`, holding one
 * row per in-flight OAuth handshake between `oauthEngine.beginAuthorization`
 * and `completeAuthorization`. `code_verifier_ref` is an opaque secret
 * reference (encrypted by `oauthEngine.ts` via the same `EncryptionProvider`
 * seam `credentialManager.ts` established) — this store never sees a
 * plaintext PKCE code_verifier, matching `credentialStore.ts`'s own
 * "never see the plaintext" discipline exactly. Mock implementation is a
 * plain in-memory array (deterministic, resets per test); GMAIL-03P adds
 * the real Supabase-backed sibling and routes every function through
 * `selectRepository()`.
 */
export interface PendingOAuthAuthorizationRow {
  state: string;
  provider_id: string;
  connection_id: string;
  workspace_id: string;
  member_id: string | null;
  redirect_uri: string;
  code_verifier_ref: string | null;
  created_at: string;
  expires_at: string;
}

let rows: PendingOAuthAuthorizationRow[] = [];

export function resetPendingOAuthAuthorizationStore(): void {
  rows = [];
}

async function mockInsertPendingAuthorization(row: PendingOAuthAuthorizationRow): Promise<PendingOAuthAuthorizationRow> {
  rows = [...rows, row];
  return row;
}

async function mockGetPendingAuthorizationByState(state: string): Promise<PendingOAuthAuthorizationRow | null> {
  return rows.find((row) => row.state === state) ?? null;
}

async function mockDeletePendingAuthorization(state: string): Promise<boolean> {
  const existed = rows.some((row) => row.state === state);
  rows = rows.filter((row) => row.state !== state);
  return existed;
}

async function mockListPendingAuthorizationsForWorkspace(workspaceId: string): Promise<PendingOAuthAuthorizationRow[]> {
  return rows.filter((row) => row.workspace_id === workspaceId);
}

export function insertPendingAuthorization(row: PendingOAuthAuthorizationRow): Promise<PendingOAuthAuthorizationRow> {
  return selectRepository({ mock: mockInsertPendingAuthorization, supabase: supabasePendingOAuthAuthorizationStore.insertPendingAuthorization })(row);
}

export function getPendingAuthorizationByState(state: string): Promise<PendingOAuthAuthorizationRow | null> {
  return selectRepository({ mock: mockGetPendingAuthorizationByState, supabase: supabasePendingOAuthAuthorizationStore.getPendingAuthorizationByState })(state);
}

export function deletePendingAuthorization(state: string): Promise<boolean> {
  return selectRepository({ mock: mockDeletePendingAuthorization, supabase: supabasePendingOAuthAuthorizationStore.deletePendingAuthorization })(state);
}

export function listPendingAuthorizationsForWorkspace(workspaceId: string): Promise<PendingOAuthAuthorizationRow[]> {
  return selectRepository({ mock: mockListPendingAuthorizationsForWorkspace, supabase: supabasePendingOAuthAuthorizationStore.listPendingAuthorizationsForWorkspace })(workspaceId);
}
