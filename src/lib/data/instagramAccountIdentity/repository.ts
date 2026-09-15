import type { InstagramAccountIdentity } from "@/types/instagramAccountIdentity";
import type { DataResult } from "@/lib/data/result";

export interface UpsertInstagramAccountIdentityInput {
  workspaceId: string;
  connectionId: string;
  instagramAccountId: string;
  instagramUsername: string | null;
}

/**
 * SOCIAL-11C — the Instagram Account Identity data-access layer. One
 * write path: `upsertInstagramAccountIdentity`, called from
 * `selectMetaPublishingIdentityAction` (the existing SOCIAL-02 flow) right
 * alongside its existing `setConnectionConfig` call — additive, never
 * replacing it. Never silently reassigns a real external account already
 * claimed by a *different* workspace (a practically rare, but
 * security-relevant, edge case — see the migration's own global-uniqueness
 * reasoning): that returns a controlled conflict error instead.
 */
export interface InstagramAccountIdentityRepository {
  upsertInstagramAccountIdentity(input: UpsertInstagramAccountIdentityInput): Promise<DataResult<InstagramAccountIdentity>>;
  /** Server-only in practice (the Meta webhook receiver's own resolution query), but implemented at this ordinary repository layer for mock/Supabase parity and testability — the webhook route itself reads through a dedicated service-role module instead, since it has no auth.uid() to satisfy this table's RLS. */
  getInstagramAccountIdentityByExternalId(instagramAccountId: string): Promise<InstagramAccountIdentity | null>;
  listInstagramAccountIdentitiesForWorkspace(workspaceId: string): Promise<InstagramAccountIdentity[]>;
}
