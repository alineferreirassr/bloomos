/**
 * SOCIAL-03 — the smallest lifecycle a Social Post actually needs for
 * "create a draft, publish it now": `draft` -> `publishing` -> `published`
 * | `failed`. `failed` -> `publishing` again on retry.
 *
 * SOCIAL-04B adds `scheduled` — the smallest addition durable scheduling
 * needs (see SOCIAL-04A's own architecture audit for why no separate
 * `claimed`/`cancelled` state was introduced): `draft` -> `scheduled` ->
 * `publishing` -> `published` | `failed`. `publishing` already carries
 * claim semantics for both the manual and scheduled paths — a claim is
 * just the same `-> publishing` transition, now legal from `scheduled` too
 * (see `beginSocialPostPublish`/`claim_due_social_posts`). `scheduled` ->
 * `draft` (cancel) and `scheduled` -> `scheduled` (reschedule) are also
 * legal, both only before a worker or a manual Publish Now has claimed the
 * post. `failed` -> `publishing` again on retry, whether triggered
 * manually or by the scheduler reclaiming a still-scheduled, still-eligible
 * failed post (see `claim_due_social_posts`'s own `scheduled_at is not
 * null` requirement — a manually-published post's failure is never
 * auto-retried).
 */
export const SOCIAL_POST_STATUSES = ["draft", "scheduled", "publishing", "published", "failed"] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};
