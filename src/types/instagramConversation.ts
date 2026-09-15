/**
 * SOCIAL-11D — one external Instagram DM thread, ingestion-only. See
 * `supabase/migrations/20260927100000_instagram_comments_conversations_messages_foundation.sql`
 * for the full reasoning behind every field's presence or deliberate
 * absence.
 */
export const INSTAGRAM_CONVERSATION_STATUSES = ["active", "archived"] as const;
export type InstagramConversationStatus = (typeof INSTAGRAM_CONVERSATION_STATUSES)[number];

export interface InstagramConversation {
  id: string;
  workspace_id: string;
  /** Nullable — survives the owning Instagram Account Identity later being disconnected/reconnected (ON DELETE SET NULL). */
  instagram_account_identity_id: string | null;
  /** Meta's own thread id, when the payload carries one. Deduplication does not depend on this alone — see `external_participant_id`'s own doc comment. */
  external_conversation_id: string | null;
  /** The external Instagram-scoped id of the non-business participant — Instagram has at most one open thread per participant pair, so this (with the owning identity) is the primary dedup key. */
  external_participant_id: string;
  external_participant_username: string | null;
  status: InstagramConversationStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}
