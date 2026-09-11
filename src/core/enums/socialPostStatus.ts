/**
 * SOCIAL-03 — the smallest lifecycle a Social Post actually needs for
 * "create a draft, publish it now" (no scheduling, no approval workflow
 * yet — those would be separate, later, mechanically-justified additions,
 * not speculative states added ahead of the code that would use them).
 *
 * `draft` -> `publishing` -> `published` | `failed`. `failed` -> `publishing`
 * again on retry (never a separate `cancelled` state — nothing in this
 * checkpoint cancels an in-flight publish).
 */
export const SOCIAL_POST_STATUSES = ["draft", "publishing", "published", "failed"] as const;
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "Draft",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};
