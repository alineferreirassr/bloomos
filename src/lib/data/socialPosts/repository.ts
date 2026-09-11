import type { SocialPost } from "@/types/socialPost";
import type { DataResult } from "@/lib/data/result";

export interface CreateSocialPostInput {
  workspaceId: string;
  createdBy: string | null;
  caption: string;
  assetId: string;
  connectionId: string;
  pageId: string;
  instagramAccountId: string;
}

export interface UpdateSocialPostDraftInput {
  caption?: string;
  assetId?: string;
}

/**
 * The single Social Posts persistence contract — implemented once by the
 * mock repository and once by the Supabase repository, mirroring every
 * other business domain's exact dual-repository pattern.
 *
 * The publish lifecycle is split into narrow, individually-transactional
 * steps rather than one "publish" call, so the calling Server Action (the
 * only place that ever talks to the real Meta API) can persist real
 * progress between each real outbound HTTP call — never losing a
 * successfully-created container id if the very next step throws.
 */
export interface SocialPostsRepository {
  listSocialPosts(workspaceId: string): Promise<SocialPost[]>;
  getSocialPost(id: string): Promise<SocialPost>;
  createSocialPost(input: CreateSocialPostInput): Promise<DataResult<SocialPost>>;
  /** Draft only — a published post's caption/asset are immutable in BloomOS (SOCIAL03-S). */
  updateSocialPostDraft(id: string, input: UpdateSocialPostDraftInput): Promise<DataResult<SocialPost>>;
  /** Atomic `draft`/`failed` -> `publishing` transition. Returns `fail()` (never mutates) if the post is not currently in an eligible source status — this is the actual idempotency guard against a double "Publish Now" click, not merely a disabled button. */
  beginSocialPostPublish(id: string): Promise<DataResult<SocialPost>>;
  /** Records a successfully-created Graph API media container id, before the publish call — so a later failure/retry can see a container already exists rather than creating a duplicate. */
  setSocialPostContainerId(id: string, containerId: string): Promise<DataResult<SocialPost>>;
  markSocialPostPublished(id: string, result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>>;
  markSocialPostFailed(id: string, providerError: string): Promise<DataResult<SocialPost>>;
}
