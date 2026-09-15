/**
 * SOCIAL-11D — one external Instagram comment, ingestion-only. No reply,
 * moderation, or business logic exists in this checkpoint — see
 * `supabase/migrations/20260927100000_instagram_comments_conversations_messages_foundation.sql`
 * for the full reasoning behind every field's presence or deliberate
 * absence.
 */
export const INSTAGRAM_COMMENT_STATUSES = ["active", "removed"] as const;
export type InstagramCommentStatus = (typeof INSTAGRAM_COMMENT_STATUSES)[number];

export interface InstagramComment {
  id: string;
  workspace_id: string;
  /** Nullable — survives the owning Instagram Account Identity later being disconnected/reconnected (ON DELETE SET NULL). */
  instagram_account_identity_id: string | null;
  external_comment_id: string;
  external_media_id: string | null;
  /** The parent comment's own external id when this is a reply — plain text, never a self-referencing FK (webhook delivery order is not guaranteed). */
  parent_external_comment_id: string | null;
  external_author_id: string;
  external_author_username: string | null;
  content: string;
  status: InstagramCommentStatus;
  external_created_at: string | null;
  created_at: string;
  updated_at: string;
}
