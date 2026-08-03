import { generateId, nowIso } from "@/lib/data/utils";
import type { IntegrationCredential } from "@/core/integrations/types";

/**
 * v2 Checkpoint 22 — the Credentials store. Mock-only, unconditionally,
 * same "new checkpoint domain, mock-only this phase" precedent every
 * brand-new domain since Checkpoint 13 has followed (`webhookEndpointStore.ts`
 * is the closest sibling). A plain top-level `let` — nothing here is ever
 * touched from a Route Handler, only from `credentialManager.ts`.
 *
 * Never stores a plaintext secret or token — see `credentialManager.ts`'s
 * own doc comment for what each `IntegrationCredential` field actually
 * holds.
 */
let credentials: IntegrationCredential[] = [];

export function resetCredentialStore(): void {
  credentials = [];
}

export function insertCredential(credential: IntegrationCredential): IntegrationCredential {
  credentials = [...credentials, credential];
  return credential;
}

export function getCredentialById(id: string): IntegrationCredential | null {
  return credentials.find((credential) => credential.id === id) ?? null;
}

export function getCredentialByConnectionId(connectionId: string): IntegrationCredential | null {
  return credentials.find((credential) => credential.connection_id === connectionId && !credential.revoked_at) ?? null;
}

export function listCredentialsForWorkspace(workspaceId: string): IntegrationCredential[] {
  return credentials.filter((credential) => credential.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function updateCredential(id: string, patch: Partial<IntegrationCredential>): IntegrationCredential | null {
  const existing = getCredentialById(id);
  if (!existing) return null;
  const updated: IntegrationCredential = { ...existing, ...patch, updated_at: nowIso() };
  credentials = credentials.map((credential) => (credential.id === id ? updated : credential));
  return updated;
}

export function generateCredentialId(): string {
  return generateId("integration-credential");
}
