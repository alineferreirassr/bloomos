import type { SocialPostStatus } from "@/core/enums/socialPostStatus";

/**
 * SOCIAL-03 — one canonical Social Post, one platform, one Asset. Not a
 * multi-platform composer: `target_provider` is always `"meta"` today, and
 * `asset_id` is a single reference into the existing, real Assets domain
 * (`MediaAsset`) — never a parallel upload/media system, and never more
 * than one Asset per post (a real carousel/multi-asset model is explicitly
 * deferred, not a schema this checkpoint tries to anticipate).
 *
 * `target_connection_id` + `target_instagram_account_id` are captured at
 * create time from the workspace's SOCIAL-02 Meta connection/selection —
 * never re-resolved implicitly at publish time from "whatever the
 * workspace's current selection happens to be," so a post always publishes
 * to the destination it was actually created for, even if the workspace's
 * selected Instagram identity changes later.
 */
export interface SocialPost {
  id: string;
  workspace_id: string;
  /** `auth.users(id)` — matches `MediaAsset.uploaded_by`/`Document.uploaded_by`'s own established convention, not `workspace_members.id`. */
  created_by: string | null;
  status: SocialPostStatus;
  caption: string;
  asset_id: string;
  target_provider: "meta";
  target_connection_id: string;
  target_page_id: string;
  target_instagram_account_id: string;
  /** The Graph API media container id — set once container creation succeeds, before the publish call. */
  provider_container_id: string | null;
  /** The published Instagram media id — set only once media_publish succeeds. */
  provider_post_id: string | null;
  /** Graph API's own permalink for the published media, when available — never fabricated from an id. */
  provider_permalink: string | null;
  /** A short, sanitized failure classification — never a raw provider response, token, or stack trace. */
  provider_error: string | null;
  published_at: string | null;
  /** SOCIAL-04B — UTC execution instant. Null for a post that has never been scheduled. */
  scheduled_at: string | null;
  /** SOCIAL-04B — IANA identifier captured at scheduling time, display-only (mirrors `CalendarEvent.timezone`) — never read by execution logic. */
  scheduled_timezone: string | null;
  /** SOCIAL-04B — incremented once per `claim_due_social_posts()` claim; stays 0 for a post that's only ever been published manually. */
  publish_attempts: number;
  /** SOCIAL-04B — earliest instant a failed, still-retryable scheduled post becomes claimable again. Null once terminal or never scheduled. */
  next_attempt_at: string | null;
  created_at: string;
  updated_at: string;
}
