/**
 * SOCIAL-05C — durable, time-series Instagram analytics storage. Instagram/
 * Meta only (never a generalized multi-provider shape) — see SOCIAL-05A's
 * own architecture-gate report for why. Nothing writes these yet;
 * SOCIAL-05D owns the sync engine that will.
 *
 * Every typed metric is `number | null`: absent from what Meta actually
 * returned is never coerced to a real `0`, mirroring
 * `MetaProvider.getInstagramMediaInsights`'s and the existing
 * `SocialPostInsights`'s own established discipline exactly.
 */

/** Forward-compatibility escape hatch only — the exact Meta metric values a snapshot captured, for any metric without (or in addition to) a typed column. Never a token, signed URL, or any other secret. */
export type RawMetrics = Record<string, number>;

/**
 * One row per (post, day). `provider_media_id` mirrors `SocialPost.provider_post_id`
 * frozen at capture time, not re-read live. `snapshot_date` (not `captured_at`)
 * is the real idempotency key a future sync upserts against — see the
 * migration's own comment for why `captured_at` alone would let every retry
 * mint a duplicate point.
 */
export interface SocialPostMetricSnapshot {
  id: string;
  workspace_id: string;
  social_post_id: string;
  provider_media_id: string;
  captured_at: string;
  snapshot_date: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  total_interactions: number | null;
  raw_metrics: RawMetrics;
  created_at: string;
}

/**
 * One row per (Instagram account, day). `instagram_account_id` is the raw
 * Graph API id — no dedicated Instagram identity table exists in this
 * schema (SOCIAL-05A's own Phase 4 finding). Only `reach`/`profile_views`
 * are typed columns: every other account-level metric remained
 * UNVERIFIED against Meta's own current documentation in SOCIAL-05A's
 * audit, so it stays in `raw_metrics` only until independently re-verified.
 */
export interface SocialAccountMetricSnapshot {
  id: string;
  workspace_id: string;
  instagram_account_id: string;
  metric_date: string;
  reach: number | null;
  profile_views: number | null;
  raw_metrics: RawMetrics;
  created_at: string;
}
