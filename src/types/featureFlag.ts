/**
 * `key` is curated free text, not a closed TS union — same "don't force a
 * code change to declare a new value" call this codebase already made for
 * `Client.source`/`category` — a new flag key should never require editing
 * this type. Every *function signature* touching a `FeatureFlag` is still
 * fully typed (see `FeatureFlagsRepository`), which is what "typed API"
 * means here, not a closed enum of keys.
 */
export interface FeatureFlag {
  id: string;
  workspace_id: string;
  key: string;
  enabled: boolean;
  updated_at: string;
}
