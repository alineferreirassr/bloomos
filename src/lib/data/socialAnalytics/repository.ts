import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot, RawMetrics } from "@/types/socialMetricSnapshot";
import type { DataResult } from "@/lib/data/result";

export interface PostSnapshotMetrics {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
  total_interactions?: number;
}

export interface AccountSnapshotMetrics {
  reach?: number;
  profile_views?: number;
}

export interface UpsertSocialPostMetricSnapshotInput {
  workspaceId: string;
  socialPostId: string;
  providerMediaId: string;
  /** ISO date (YYYY-MM-DD). Defaults to today — the real idempotency key alongside socialPostId; see the migration's own comment for why this, not captured_at. */
  snapshotDate?: string;
  metrics: PostSnapshotMetrics;
  rawMetrics: RawMetrics;
}

export interface UpsertSocialAccountMetricSnapshotInput {
  workspaceId: string;
  instagramAccountId: string;
  metricDate: string;
  metrics: AccountSnapshotMetrics;
  rawMetrics: RawMetrics;
}

/**
 * SOCIAL-05C — the persistence foundation only: no sync engine calls any
 * of this yet (SOCIAL-05D's own scope). Mirrors every other domain's exact
 * dual mock/Supabase repository pattern.
 *
 * Every `upsert*` call re-verifies workspace ownership itself (the FK
 * alone cannot prove a caller-supplied workspaceId actually matches the
 * referenced post/account's own workspace) — mirrors
 * `socialPostActions.ts`'s own `loadOwnedPost` pattern exactly. A
 * mismatch returns `fail()`, never a silently-scoped-wrong row.
 */
export interface SocialAnalyticsRepository {
  upsertSocialPostMetricSnapshot(input: UpsertSocialPostMetricSnapshotInput): Promise<DataResult<SocialPostMetricSnapshot>>;
  listSocialPostMetricSnapshots(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot[]>;
  getLatestSocialPostMetricSnapshot(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot | null>;

  upsertSocialAccountMetricSnapshot(input: UpsertSocialAccountMetricSnapshotInput): Promise<DataResult<SocialAccountMetricSnapshot>>;
  listSocialAccountMetricSnapshots(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot[]>;
  getLatestSocialAccountMetricSnapshot(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot | null>;
}
