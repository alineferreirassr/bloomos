import { getSocialPostByProviderPostId } from "@/lib/data";
import type { InstagramComment } from "@/types/instagramComment";
import type { SocialPost } from "@/types/socialPost";

/**
 * SOCIAL-15B — the Post<->Comment read-time join SOCIAL-15A's own audit
 * called for: `instagram_comments.external_media_id` and
 * `social_posts.provider_post_id` are both real Meta-assigned media ids,
 * already stored on their respective rows, never previously joined
 * anywhere in the codebase. This resolves one to the other by exact id
 * equality only — never a timestamp, username, text, proximity, or any
 * other heuristic.
 *
 * Workspace-scoped by construction, not by caller discipline: this
 * function always derives the scoping workspaceId from the comment row
 * itself (`comment.workspace_id`, already RLS-protected/real) rather than
 * accepting one as a parameter — there is no way to call this function and
 * have it resolve a Social Post belonging to a different workspace than
 * the comment's own.
 *
 * Read-time only: no schema was added to persist this relationship on
 * `instagram_comments` itself (SOCIAL-15A's own finding was that the
 * existing `external_media_id` column plus this join is sufficient; no
 * additional column/table was demonstrated necessary). Returns `null` when
 * the comment carries no `external_media_id` (some webhook payload shapes
 * omit it) or when no Social Post in this comment's own workspace was ever
 * published with that exact `provider_post_id`.
 */
export async function resolveSocialPostForInstagramComment(comment: InstagramComment): Promise<SocialPost | null> {
  if (!comment.external_media_id) return null;
  return getSocialPostByProviderPostId(comment.workspace_id, comment.external_media_id);
}
