/**
 * SOCIAL-11C — Instagram Account Identity. Promotes the external Instagram
 * professional account identifier out of `SocialPost.target_instagram_account_id`'s
 * own denormalized snapshot into a real, workspace-scoped, indexed entity —
 * not because that snapshot was wrong (it deliberately stays exactly as-is,
 * unaltered by this checkpoint, so an already-created Social Post keeps
 * publishing to the destination it was actually created for), but because
 * the Meta webhook receiver needs a single, indexed, unambiguous reverse
 * lookup — "given this external Instagram account id from an inbound
 * webhook, which BloomOS workspace owns it?" — that nothing in the schema
 * provided before this checkpoint (the only prior storage,
 * `integration_connections.config->>'meta_instagram_account_id'`, is a
 * plain unindexed JSONB key, not a queryable identity).
 *
 * Represents the external account identity only, never credentials — an
 * Instagram Account Identity carries no access token of its own. Every
 * credential remains exactly where SOCIAL-02 already put it:
 * `integration_credentials`, resolved only through the existing
 * `credentialManager.ts`/Vault path. `connection_id` is how this identity
 * proves which Meta connection (and therefore which credential) it belongs
 * to — never a second credential store.
 */
export interface InstagramAccountIdentity {
  id: string;
  workspace_id: string;
  /** The `integration_connections` row (provider_id = "meta") this identity was selected through. */
  connection_id: string;
  /** The Graph API IG-scoped user id (`instagram_business_account.id`) — globally unique across every BloomOS workspace, since a real Instagram Business Account can only be the subscribed webhook target of one owning workspace at a time. */
  instagram_account_id: string;
  /** Display-only, captured at the same moment as `instagram_account_id` during account selection — never re-fetched independently. */
  instagram_username: string | null;
  created_at: string;
  updated_at: string;
}
