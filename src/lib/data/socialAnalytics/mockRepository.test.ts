import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockSocialAnalyticsRepository } from "@/lib/data/socialAnalytics/mockRepository";
import { resetSocialAnalyticsStore } from "@/lib/data/mock/socialAnalyticsStore";
import { resetSocialPostsStore, writeSocialPosts } from "@/lib/data/mock/socialPostsStore";
import type { SocialPost } from "@/types/socialPost";

const WORKSPACE_ID = "ws_amore_bloom";
const OTHER_WORKSPACE_ID = "ws_other_tenant";

function seedPost(overrides: Partial<SocialPost> = {}): SocialPost {
  const post: SocialPost = {
    id: "social_post_1",
    workspace_id: WORKSPACE_ID,
    created_by: "member_1",
    status: "published",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: "17900000000000001",
    provider_permalink: null,
    provider_error: null,
    published_at: "2026-09-17T00:00:00Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-17T00:00:00Z",
    updated_at: "2026-09-17T00:00:00Z",
    ...overrides,
  };
  writeSocialPosts([post]);
  return post;
}

beforeEach(() => {
  resetSocialAnalyticsStore();
  resetSocialPostsStore();
});
afterEach(() => {
  resetSocialAnalyticsStore();
  resetSocialPostsStore();
});

describe("mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot", () => {
  it("inserts a new post snapshot with the given metrics and raw_metrics", async () => {
    seedPost();
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      snapshotDate: "2026-09-17",
      metrics: { reach: 120, likes: 10 },
      rawMetrics: { reach: 120, likes: 10 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reach).toBe(120);
    expect(result.data.likes).toBe(10);
    expect(result.data.raw_metrics).toEqual({ reach: 120, likes: 10 });
  });

  it("preserves null for a metric Meta didn't return — never coerces to a real zero", async () => {
    seedPost();
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 0 },
      rawMetrics: { reach: 0 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reach).toBe(0);
    expect(result.data.likes).toBeNull();
    expect(result.data.views).toBeNull();
  });

  it("a retry for the same (social_post_id, snapshot_date) updates the same row rather than creating a duplicate", async () => {
    seedPost();
    const first = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      snapshotDate: "2026-09-17",
      metrics: { reach: 100 },
      rawMetrics: { reach: 100 },
    });
    const second = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      snapshotDate: "2026-09-17",
      metrics: { reach: 150 },
      rawMetrics: { reach: 150 },
    });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);
    expect(second.data.reach).toBe(150);

    const history = await mockSocialAnalyticsRepository.listSocialPostMetricSnapshots(WORKSPACE_ID, "social_post_1");
    expect(history).toHaveLength(1);
  });

  it("a different snapshot_date for the same post creates a second, distinct history point", async () => {
    seedPost();
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      snapshotDate: "2026-09-17",
      metrics: { reach: 100 },
      rawMetrics: {},
    });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      snapshotDate: "2026-09-18",
      metrics: { reach: 130 },
      rawMetrics: {},
    });
    const history = await mockSocialAnalyticsRepository.listSocialPostMetricSnapshots(WORKSPACE_ID, "social_post_1");
    expect(history).toHaveLength(2);
  });

  it("rejects a post that belongs to a different workspace — cross-workspace snapshot creation is impossible", async () => {
    seedPost({ workspace_id: OTHER_WORKSPACE_ID });
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: {},
      rawMetrics: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a nonexistent post id", async () => {
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "does_not_exist",
      providerMediaId: "17900000000000001",
      metrics: {},
      rawMetrics: {},
    });
    expect(result.success).toBe(false);
  });

  it("preserves an unknown raw metric Meta returned but this schema has no typed column for", async () => {
    seedPost();
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 100 },
      rawMetrics: { reach: 100, some_future_metric: 42 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.raw_metrics.some_future_metric).toBe(42);
  });
});

describe("mockSocialAnalyticsRepository — post snapshot history/latest/workspace filtering", () => {
  it("lists history in reverse-chronological order and returns the latest as the newest", async () => {
    seedPost();
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: WORKSPACE_ID, socialPostId: "social_post_1", providerMediaId: "p1", snapshotDate: "2026-09-15", metrics: { reach: 10 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: WORKSPACE_ID, socialPostId: "social_post_1", providerMediaId: "p1", snapshotDate: "2026-09-16", metrics: { reach: 20 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: WORKSPACE_ID, socialPostId: "social_post_1", providerMediaId: "p1", snapshotDate: "2026-09-17", metrics: { reach: 30 }, rawMetrics: {} });

    const history = await mockSocialAnalyticsRepository.listSocialPostMetricSnapshots(WORKSPACE_ID, "social_post_1");
    expect(history.map((s) => s.snapshot_date)).toEqual(["2026-09-17", "2026-09-16", "2026-09-15"]);

    const latest = await mockSocialAnalyticsRepository.getLatestSocialPostMetricSnapshot(WORKSPACE_ID, "social_post_1");
    expect(latest?.reach).toBe(30);
  });

  it("never returns another workspace's snapshots", async () => {
    seedPost();
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: WORKSPACE_ID, socialPostId: "social_post_1", providerMediaId: "p1", metrics: {}, rawMetrics: {} });
    const history = await mockSocialAnalyticsRepository.listSocialPostMetricSnapshots(OTHER_WORKSPACE_ID, "social_post_1");
    expect(history).toHaveLength(0);
  });

  it("returns null latest snapshot when none exist yet", async () => {
    const latest = await mockSocialAnalyticsRepository.getLatestSocialPostMetricSnapshot(WORKSPACE_ID, "no_snapshots_yet");
    expect(latest).toBeNull();
  });
});

describe("mockSocialAnalyticsRepository — account snapshots", () => {
  it("inserts and preserves nullable metrics and raw_metrics", async () => {
    const result = await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      instagramAccountId: "ig_1",
      metricDate: "2026-09-17",
      metrics: { reach: 500 },
      rawMetrics: { reach: 500 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reach).toBe(500);
    expect(result.data.profile_views).toBeNull();
  });

  it("a retry for the same (workspace_id, instagram_account_id, metric_date) updates the same row", async () => {
    const first = await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-17", metrics: { reach: 100 }, rawMetrics: {} });
    const second = await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-17", metrics: { reach: 200 }, rawMetrics: {} });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);

    const history = await mockSocialAnalyticsRepository.listSocialAccountMetricSnapshots(WORKSPACE_ID, "ig_1");
    expect(history).toHaveLength(1);
  });

  it("the same instagram_account_id in a different workspace is a distinct series (workspace_id is part of the key)", async () => {
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-17", metrics: { reach: 100 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: OTHER_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-17", metrics: { reach: 999 }, rawMetrics: {} });

    const ownHistory = await mockSocialAnalyticsRepository.listSocialAccountMetricSnapshots(WORKSPACE_ID, "ig_1");
    expect(ownHistory).toHaveLength(1);
    expect(ownHistory[0].reach).toBe(100);
  });

  it("chronological history returns newest metric_date first, and latest matches it", async () => {
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-15", metrics: { reach: 10 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-17", metrics: { reach: 30 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: "2026-09-16", metrics: { reach: 20 }, rawMetrics: {} });

    const history = await mockSocialAnalyticsRepository.listSocialAccountMetricSnapshots(WORKSPACE_ID, "ig_1");
    expect(history.map((s) => s.metric_date)).toEqual(["2026-09-17", "2026-09-16", "2026-09-15"]);

    const latest = await mockSocialAnalyticsRepository.getLatestSocialAccountMetricSnapshot(WORKSPACE_ID, "ig_1");
    expect(latest?.metric_date).toBe("2026-09-17");
  });
});

describe("mockSocialAnalyticsRepository — raw_metrics never carries secret-shaped fields", () => {
  it("the repository input/output contract has no field for tokens, signed URLs, or credentials", async () => {
    seedPost();
    const result = await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: WORKSPACE_ID,
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 10 },
      rawMetrics: { reach: 10 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toMatch(/access_token|refresh_token|signed_url|client_secret/i);
  });
});
