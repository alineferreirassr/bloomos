/**
 * SOCIAL-11D — one external Instagram DM message within a conversation,
 * ingestion-only. See
 * `supabase/migrations/20260927100000_instagram_comments_conversations_messages_foundation.sql`
 * for the full reasoning behind every field's presence or deliberate
 * absence.
 */
export const INSTAGRAM_MESSAGE_DIRECTIONS = ["inbound", "outbound"] as const;
export type InstagramMessageDirection = (typeof INSTAGRAM_MESSAGE_DIRECTIONS)[number];

export interface InstagramMessage {
  id: string;
  conversation_id: string;
  /** Denormalized from the owning conversation, independently NOT NULL — direct RLS/query use without a join. */
  workspace_id: string;
  external_message_id: string;
  /** `"inbound"` = from the external participant, `"outbound"` = from the business account (including one sent directly in the Instagram app, outside BloomOS). */
  direction: InstagramMessageDirection;
  /** Free text, not a closed enum — Instagram's own message types are an external, evolving vocabulary this checkpoint does not enumerate. */
  message_type: string;
  content: string | null;
  /** A raw external reference/URL/id only, when the message carries media — never a new attachment/storage subsystem. */
  external_media_reference: string | null;
  external_created_at: string | null;
  created_at: string;
  updated_at: string;
}
