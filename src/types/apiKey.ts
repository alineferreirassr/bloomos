import type { ApiScope } from "@/types/apiScope";

/**
 * Checkpoint 16, Step 2 — a Workspace-scoped API Key. The secret itself is
 * never stored — only `key_hash` (SHA-256 hex digest, the same "never a
 * plaintext token stored anywhere" discipline `lib/team/invitationToken.ts`
 * already established for invitation tokens) and `key_prefix` (the first
 * 12 characters of the real secret, shown in the Developer Console so a
 * member can recognize *which* key a log line or an integration is using
 * without the full secret ever being retrievable again after creation).
 */
export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: ApiScope[];
  created_by: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  /** Set the moment a rotation replaces this key's own secret — the record itself is never deleted on rotation, only superseded, so "last used" history isn't lost. */
  rotated_at: string | null;
}

/** Returned exactly once, at creation or rotation time — the only moment the real secret is ever visible. Never persisted, never re-derivable from `ApiKey.key_hash`. */
export interface ApiKeyWithSecret {
  key: ApiKey;
  secret: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiScope[];
}
