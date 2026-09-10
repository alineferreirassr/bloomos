import { generateId, nowIso } from "@/lib/data/utils";
import { selectRepository } from "@/lib/data/provider";
import * as supabaseCredentialStore from "@/lib/data/core/integrations/supabaseCredentialStore";
import type { IntegrationCredential } from "@/core/integrations/types";

/**
 * The Credentials store. Mock implementation kept exactly as it has been
 * since v2 Checkpoint 22 (a plain top-level `let`, nothing here ever
 * touched from a Route Handler, only from `credentialManager.ts`) — GMAIL-02
 * adds a real Supabase-backed sibling (`supabaseCredentialStore.ts`) and
 * routes every function below through `selectRepository()`, the same
 * "one central NEXT_PUBLIC_DATA_MODE switch, never scattered" convention
 * every other BloomOS module already uses (`lib/data/provider.ts`). Mock
 * mode's own behavior is unchanged — every function was already only ever
 * awaited by its callers (`credentialManager.ts` is `async` throughout),
 * so wrapping the existing synchronous logic in a resolved Promise here is
 * not a behavior change, just a shape match for the real branch.
 *
 * Never stores a plaintext secret or token — see `credentialManager.ts`'s
 * own doc comment for what each `IntegrationCredential` field actually
 * holds.
 */
let credentials: IntegrationCredential[] = [];

export function resetCredentialStore(): void {
  credentials = [];
}

async function mockInsertCredential(credential: IntegrationCredential): Promise<IntegrationCredential> {
  credentials = [...credentials, credential];
  return credential;
}

async function mockGetCredentialById(id: string): Promise<IntegrationCredential | null> {
  return credentials.find((credential) => credential.id === id) ?? null;
}

async function mockGetCredentialByConnectionId(connectionId: string): Promise<IntegrationCredential | null> {
  return credentials.find((credential) => credential.connection_id === connectionId && !credential.revoked_at) ?? null;
}

async function mockListCredentialsForWorkspace(workspaceId: string): Promise<IntegrationCredential[]> {
  return credentials.filter((credential) => credential.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function mockUpdateCredential(id: string, patch: Partial<IntegrationCredential>): Promise<IntegrationCredential | null> {
  const existing = await mockGetCredentialById(id);
  if (!existing) return null;
  const updated: IntegrationCredential = { ...existing, ...patch, updated_at: nowIso() };
  credentials = credentials.map((credential) => (credential.id === id ? updated : credential));
  return updated;
}

export function insertCredential(credential: IntegrationCredential): Promise<IntegrationCredential> {
  return selectRepository({ mock: mockInsertCredential, supabase: supabaseCredentialStore.insertCredential })(credential);
}

export function getCredentialById(id: string): Promise<IntegrationCredential | null> {
  return selectRepository({ mock: mockGetCredentialById, supabase: supabaseCredentialStore.getCredentialById })(id);
}

export function getCredentialByConnectionId(connectionId: string): Promise<IntegrationCredential | null> {
  return selectRepository({ mock: mockGetCredentialByConnectionId, supabase: supabaseCredentialStore.getCredentialByConnectionId })(connectionId);
}

export function listCredentialsForWorkspace(workspaceId: string): Promise<IntegrationCredential[]> {
  return selectRepository({ mock: mockListCredentialsForWorkspace, supabase: supabaseCredentialStore.listCredentialsForWorkspace })(workspaceId);
}

export function updateCredential(id: string, patch: Partial<IntegrationCredential>): Promise<IntegrationCredential | null> {
  return selectRepository({ mock: mockUpdateCredential, supabase: supabaseCredentialStore.updateCredential })(id, patch);
}

export function generateCredentialId(): string {
  return generateId("integration-credential");
}
