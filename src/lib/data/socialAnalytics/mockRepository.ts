import type { SocialAccountMetricSnapshot, SocialPostMetricSnapshot } from "@/types/socialMetricSnapshot";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readSocialPosts } from "@/lib/data/mock/socialPostsStore";
import {
  readPostMetricSnapshots,
  writePostMetricSnapshots,
  readAccountMetricSnapshots,
  writeAccountMetricSnapshots,
} from "@/lib/data/mock/socialAnalyticsStore";
import type {
  SocialAnalyticsRepository,
  UpsertSocialAccountMetricSnapshotInput,
  UpsertSocialPostMetricSnapshotInput,
} from "@/lib/data/socialAnalytics/repository";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const NOT_FOUND_ERROR = "This social post could not be found.";

async function upsertSocialPostMetricSnapshot(input: UpsertSocialPostMetricSnapshotInput): Promise<DataResult<SocialPostMetricSnapshot>> {
  const post = readSocialPosts().find((p) => p.id === input.socialPostId);
  if (!post || post.workspace_id !== input.workspaceId) return fail(NOT_FOUND_ERROR);

  const snapshotDate = input.snapshotDate ?? todayIsoDate();
  const existing = readPostMetricSnapshots().find((s) => s.social_post_id === input.socialPostId && s.snapshot_date === snapshotDate);
  const timestamp = nowIso();

  const snapshot: SocialPostMetricSnapshot = {
    id: existing?.id ?? generateId("social_post_metric_snapshot"),
    workspace_id: input.workspaceId,
    social_post_id: input.socialPostId,
    provider_media_id: input.providerMediaId,
    captured_at: timestamp,
    snapshot_date: snapshotDate,
    views: input.metrics.views ?? null,
    reach: input.metrics.reach ?? null,
    likes: input.metrics.likes ?? null,
    comments: input.metrics.comments ?? null,
    shares: input.metrics.shares ?? null,
    saved: input.metrics.saved ?? null,
    total_interactions: input.metrics.total_interactions ?? null,
    raw_metrics: input.rawMetrics,
    created_at: existing?.created_at ?? timestamp,
  };

  writePostMetricSnapshots(existing ? readPostMetricSnapshots().map((s) => (s.id === existing.id ? snapshot : s)) : [...readPostMetricSnapshots(), snapshot]);
  return ok(snapshot);
}

async function listSocialPostMetricSnapshots(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot[]> {
  // Sorted by the logical snapshot_date, never captured_at (real
  // wall-clock capture instant) — a retry or backfill can be captured out
  // of order relative to the logical day it represents, and snapshot_date
  // is the actual meaningful time-series axis (it's also the real
  // idempotency key — see the migration's own comment).
  return readPostMetricSnapshots()
    .filter((s) => s.workspace_id === workspaceId && s.social_post_id === socialPostId)
    .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
}

async function getLatestSocialPostMetricSnapshot(workspaceId: string, socialPostId: string): Promise<SocialPostMetricSnapshot | null> {
  const history = await listSocialPostMetricSnapshots(workspaceId, socialPostId);
  return history[0] ?? null;
}

async function listLatestSocialPostMetricSnapshotsForWorkspace(workspaceId: string, socialPostIds: string[]): Promise<SocialPostMetricSnapshot[]> {
  const idSet = new Set(socialPostIds);
  const latestByPost = new Map<string, SocialPostMetricSnapshot>();
  for (const snapshot of readPostMetricSnapshots()) {
    if (snapshot.workspace_id !== workspaceId || !idSet.has(snapshot.social_post_id)) continue;
    const current = latestByPost.get(snapshot.social_post_id);
    if (!current || snapshot.snapshot_date > current.snapshot_date) latestByPost.set(snapshot.social_post_id, snapshot);
  }
  return [...latestByPost.values()];
}

async function upsertSocialAccountMetricSnapshot(input: UpsertSocialAccountMetricSnapshotInput): Promise<DataResult<SocialAccountMetricSnapshot>> {
  const existing = readAccountMetricSnapshots().find(
    (s) => s.workspace_id === input.workspaceId && s.instagram_account_id === input.instagramAccountId && s.metric_date === input.metricDate,
  );
  const timestamp = nowIso();

  const snapshot: SocialAccountMetricSnapshot = {
    id: existing?.id ?? generateId("social_account_metric_snapshot"),
    workspace_id: input.workspaceId,
    instagram_account_id: input.instagramAccountId,
    metric_date: input.metricDate,
    reach: input.metrics.reach ?? null,
    profile_views: input.metrics.profile_views ?? null,
    raw_metrics: input.rawMetrics,
    created_at: existing?.created_at ?? timestamp,
  };

  writeAccountMetricSnapshots(existing ? readAccountMetricSnapshots().map((s) => (s.id === existing.id ? snapshot : s)) : [...readAccountMetricSnapshots(), snapshot]);
  return ok(snapshot);
}

async function listSocialAccountMetricSnapshots(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot[]> {
  return readAccountMetricSnapshots()
    .filter((s) => s.workspace_id === workspaceId && s.instagram_account_id === instagramAccountId)
    .sort((a, b) => b.metric_date.localeCompare(a.metric_date));
}

async function getLatestSocialAccountMetricSnapshot(workspaceId: string, instagramAccountId: string): Promise<SocialAccountMetricSnapshot | null> {
  const history = await listSocialAccountMetricSnapshots(workspaceId, instagramAccountId);
  return history[0] ?? null;
}

export const mockSocialAnalyticsRepository: SocialAnalyticsRepository = {
  upsertSocialPostMetricSnapshot,
  listSocialPostMetricSnapshots,
  getLatestSocialPostMetricSnapshot,
  listLatestSocialPostMetricSnapshotsForWorkspace,
  upsertSocialAccountMetricSnapshot,
  listSocialAccountMetricSnapshots,
  getLatestSocialAccountMetricSnapshot,
};
