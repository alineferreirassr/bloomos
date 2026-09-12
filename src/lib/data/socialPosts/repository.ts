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

export interface ScheduleSocialPostInput {
  scheduledAt: string;
  scheduledTimezone: string | null;
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
  /**
   * Atomic `draft`/`scheduled`/`failed` -> `publishing` transition. Returns
   * `fail()` (never mutates) if the post is not currently in an eligible
   * source status — this is the actual idempotency guard against a double
   * "Publish Now" click, and (SOCIAL-04B) the same guard that decides the
   * manual-vs-scheduler race (`claim_due_social_posts()` competes on this
   * exact `status` column): whichever transaction commits first wins,
   * the other affects zero rows and gets a deterministic `fail()`.
   */
  beginSocialPostPublish(id: string): Promise<DataResult<SocialPost>>;
  /** Records a successfully-created Graph API media container id, before the publish call — so a later failure/retry can see a container already exists rather than creating a duplicate. */
  setSocialPostContainerId(id: string, containerId: string): Promise<DataResult<SocialPost>>;
  markSocialPostPublished(id: string, result: { providerPostId: string; providerPermalink: string | null }): Promise<DataResult<SocialPost>>;
  markSocialPostFailed(id: string, providerError: string): Promise<DataResult<SocialPost>>;

  /**
   * SOCIAL-04B — atomic `draft`/`failed` -> `scheduled`. Legal from `failed`
   * too (explicit reschedule-a-failed-post support, SOCIAL-04A Phase 9),
   * which resets `publish_attempts`/`next_attempt_at` to a fresh cycle — a
   * human explicitly rescheduling is a deliberate new attempt, never
   * permanently blocked by an earlier exhausted attempt count.
   */
  scheduleSocialPost(id: string, input: ScheduleSocialPostInput): Promise<DataResult<SocialPost>>;
  /** Atomic `scheduled` -> `scheduled` only — rejects once a worker or manual Publish Now has claimed the post (status is then `publishing`/`published`). */
  rescheduleSocialPost(id: string, input: ScheduleSocialPostInput): Promise<DataResult<SocialPost>>;
  /** Atomic `scheduled` -> `draft`. Clears scheduling-only fields (`scheduled_at`/`scheduled_timezone`/`next_attempt_at`); never touches caption/asset/destination. Rejects once claimed. */
  cancelSocialPostSchedule(id: string): Promise<DataResult<SocialPost>>;
}
