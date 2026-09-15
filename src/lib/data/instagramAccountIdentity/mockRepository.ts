import type { InstagramAccountIdentity } from "@/types/instagramAccountIdentity";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import type { InstagramAccountIdentityRepository, UpsertInstagramAccountIdentityInput } from "@/lib/data/instagramAccountIdentity/repository";

let identities: InstagramAccountIdentity[] = [];

export function resetInstagramAccountIdentitiesStore(): void {
  identities = [];
}

const ALREADY_CLAIMED_ERROR = "This Instagram account is already connected to a different workspace.";

async function upsertInstagramAccountIdentity(input: UpsertInstagramAccountIdentityInput): Promise<DataResult<InstagramAccountIdentity>> {
  const existing = identities.find((identity) => identity.instagram_account_id === input.instagramAccountId);
  if (existing && existing.workspace_id !== input.workspaceId) return fail(ALREADY_CLAIMED_ERROR);

  const timestamp = nowIso();
  if (existing) {
    const updated: InstagramAccountIdentity = {
      ...existing,
      connection_id: input.connectionId,
      instagram_username: input.instagramUsername,
      updated_at: timestamp,
    };
    identities = identities.map((identity) => (identity.id === existing.id ? updated : identity));
    return ok(updated);
  }

  const created: InstagramAccountIdentity = {
    id: generateId("instagram_account_identity"),
    workspace_id: input.workspaceId,
    connection_id: input.connectionId,
    instagram_account_id: input.instagramAccountId,
    instagram_username: input.instagramUsername,
    created_at: timestamp,
    updated_at: timestamp,
  };
  identities = [...identities, created];
  return ok(created);
}

async function getInstagramAccountIdentityByExternalId(instagramAccountId: string): Promise<InstagramAccountIdentity | null> {
  return identities.find((identity) => identity.instagram_account_id === instagramAccountId) ?? null;
}

async function listInstagramAccountIdentitiesForWorkspace(workspaceId: string): Promise<InstagramAccountIdentity[]> {
  return identities.filter((identity) => identity.workspace_id === workspaceId);
}

export const mockInstagramAccountIdentityRepository: InstagramAccountIdentityRepository = {
  upsertInstagramAccountIdentity,
  getInstagramAccountIdentityByExternalId,
  listInstagramAccountIdentitiesForWorkspace,
};
