import type { InstagramComment, InstagramCommentStatus } from "@/types/instagramComment";
import type { DataResult } from "@/lib/data/result";

export interface CreateInstagramCommentInput {
  workspaceId: string;
  instagramAccountIdentityId: string;
  externalCommentId: string;
  externalMediaId: string | null;
  parentExternalCommentId: string | null;
  externalAuthorId: string;
  externalAuthorUsername: string | null;
  content: string;
  externalCreatedAt: string | null;
}

/**
 * SOCIAL-11D — the Instagram Comment data-access layer. Deliberately
 * standalone (never bundled with Conversation/Message — a comment has no
 * relationship to a DM thread). No reply/moderation methods exist or
 * should be added here; only what a future ingestion step (SOCIAL-11E)
 * genuinely needs: dedup-before-create via `getCommentByExternalId`, and
 * `updateCommentStatus` (the one field this checkpoint's own schema
 * exposes as mutable).
 */
export interface InstagramCommentRepository {
  createComment(input: CreateInstagramCommentInput): Promise<DataResult<InstagramComment>>;
  /** Scoped to one Instagram Account Identity — the entity-level dedup lookup a future ingestion step must call before creating a row. */
  getCommentByExternalId(instagramAccountIdentityId: string, externalCommentId: string): Promise<InstagramComment | null>;
  /**
   * SOCIAL-15C — the workspace-safe lookup by internal id the Instagram
   * comment-triggered Lead-capture Action uses to resolve the real
   * `InstagramComment` row behind a trigger's own `facts.commentId`,
   * before handing it to `resolveSocialPostForInstagramComment()`. Always
   * scoped by the caller's own `workspaceId` at the query level (never a
   * bare id lookup) — returns `null` both when no row has that id and
   * when it exists but belongs to a different workspace, so a caller can
   * never distinguish "doesn't exist" from "exists, wrong workspace" and
   * is never tempted to trust an unscoped result.
   */
  getCommentById(id: string, workspaceId: string): Promise<InstagramComment | null>;
  listCommentsForWorkspace(workspaceId: string): Promise<InstagramComment[]>;
  updateCommentStatus(id: string, status: InstagramCommentStatus): Promise<DataResult<InstagramComment>>;
}
