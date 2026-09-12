import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getSocialAnalyticsDashboardAction } from "@/modules/socialPosts/socialAnalyticsActions";
import { installProvider, attachCredential, applyConnectionEvent, setConnectionConfig } from "@/core/integrations/integrationManager";
import { issueOAuthCredential, resetEncryptionProvider } from "@/core/integrations/credentialManager";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetSocialPostsStore, writeSocialPosts } from "@/lib/data/mock/socialPostsStore";
import { resetSocialAnalyticsStore } from "@/lib/data/mock/socialAnalyticsStore";
import { mockSocialAnalyticsRepository } from "@/lib/data/socialAnalytics/mockRepository";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import type { SocialPost } from "@/types/socialPost";

const FULL_SCOPES = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish", "instagram_manage_insights"];

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view", "social.create", "social.publish"],
  workspaceDisplayName: "Amoré Bloom",
};

const noPermissionSession: MemberSessionSnapshot = { ...session, permissions: [] };

function post(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: CURRENT_WORKSPACE_ID,
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
    published_at: new Date().toISOString(),
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

async function connectMetaWithSelectedIdentity(workspaceId: string = CURRENT_WORKSPACE_ID): Promise<void> {
  const connection = await installProvider({ workspaceId, providerId: "meta", installedBy: "member_1" });
  const credential = await issueOAuthCredential({ workspaceId, connectionId: connection.id, scopes: FULL_SCOPES, createdBy: "member_1", accessToken: "real-meta-access-token" });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_requested", "member_1");
  await applyConnectionEvent(connection.id, "connect_succeeded", "member_1");
  await setConnectionConfig(connection.id, { meta_page_id: "page_1", meta_page_name: "Amoré Bloom", meta_instagram_account_id: "ig_1", meta_instagram_username: "amorebloom" });
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function daysAgoDate(days: number): string {
  return daysAgoIso(days).slice(0, 10);
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetSocialPostsStore();
  resetSocialAnalyticsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSocialAnalyticsDashboardAction — access control", () => {
  it("denies a member without social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionSession);
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(false);
  });

  it("denies an inactive/unauthenticated session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as never);
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(false);
  });
});

describe("getSocialAnalyticsDashboardAction — workspace derivation and isolation", () => {
  it("derives the workspace id from the session, never from a caller-supplied value — the exact defect class SOCIAL-LIVE-01B fixed", async () => {
    writeSocialPosts([post()]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "post_1", providerMediaId: "17900000000000001", metrics: { reach: 120 }, rawMetrics: { reach: 120 } });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance).toHaveLength(1);
  });

  it("never returns another workspace's posts or snapshots — the calling session stays CURRENT_WORKSPACE_ID while the post belongs elsewhere", async () => {
    writeSocialPosts([post({ id: "post_other", workspace_id: "ws_other_tenant" })]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: "ws_other_tenant", socialPostId: "post_other", providerMediaId: "p", metrics: { reach: 999 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance).toHaveLength(0);
  });
});

describe("getSocialAnalyticsDashboardAction — post performance", () => {
  it("only includes published posts, never draft/scheduled/publishing/failed", async () => {
    writeSocialPosts([
      post({ id: "p_published", status: "published" }),
      post({ id: "p_draft", status: "draft", published_at: null }),
      post({ id: "p_scheduled", status: "scheduled", published_at: null }),
      post({ id: "p_publishing", status: "publishing", published_at: null }),
      post({ id: "p_failed", status: "failed", published_at: null }),
    ]);
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance.map((r) => r.post.id)).toEqual(["p_published"]);
  });

  it("pairs each post with its latest snapshot, or null when never synced — never a fabricated row", async () => {
    writeSocialPosts([post({ id: "p_synced" }), post({ id: "p_never_synced" })]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_synced", providerMediaId: "p", metrics: { reach: 50 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    const byId = new Map(result.data.postPerformance.map((r) => [r.post.id, r.snapshot]));
    expect(byId.get("p_synced")?.reach).toBe(50);
    expect(byId.get("p_never_synced")).toBeNull();
  });

  it("excludes a published post outside the selected range", async () => {
    writeSocialPosts([post({ id: "p_recent", published_at: daysAgoIso(2) }), post({ id: "p_old", published_at: daysAgoIso(45) })]);
    const result = await getSocialAnalyticsDashboardAction("7d");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance.map((r) => r.post.id)).toEqual(["p_recent"]);
  });

  it("hasAnyPublishedPosts distinguishes 'no posts at all' from 'no posts in this range' — true even when the range excludes everything", async () => {
    writeSocialPosts([post({ id: "p_old", published_at: daysAgoIso(45) })]);
    const result = await getSocialAnalyticsDashboardAction("7d");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance).toHaveLength(0);
    expect(result.data.hasAnyPublishedPosts).toBe(true);
  });

  it("hasAnyPublishedPosts is false for a workspace with zero published posts", async () => {
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.hasAnyPublishedPosts).toBe(false);
  });

  it("preserves null for a missing metric and a real zero distinctly", async () => {
    writeSocialPosts([post()]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "post_1", providerMediaId: "p", metrics: { likes: 0 }, rawMetrics: { likes: 0 } });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance[0].snapshot?.likes).toBe(0);
    expect(result.data.postPerformance[0].snapshot?.reach).toBeNull();
  });
});

describe("getSocialAnalyticsDashboardAction — top posts ranking", () => {
  it("ranks by total_interactions descending, tie-breaking by published_at descending", async () => {
    writeSocialPosts([
      post({ id: "p_low", published_at: daysAgoIso(1) }),
      post({ id: "p_high", published_at: daysAgoIso(2) }),
      post({ id: "p_tie_newer", published_at: daysAgoIso(3) }),
      post({ id: "p_tie_older", published_at: daysAgoIso(4) }),
    ]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_low", providerMediaId: "p", metrics: { total_interactions: 5 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_high", providerMediaId: "p", metrics: { total_interactions: 50 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_tie_newer", providerMediaId: "p", metrics: { total_interactions: 20 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_tie_older", providerMediaId: "p", metrics: { total_interactions: 20 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction("30d");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.topPosts.map((r) => r.post.id)).toEqual(["p_high", "p_tie_newer", "p_tie_older", "p_low"]);
  });

  it("never ranks a post with a null total_interactions — excluded, not treated as zero", async () => {
    writeSocialPosts([post({ id: "p_ranked" }), post({ id: "p_unranked" })]);
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_ranked", providerMediaId: "p", metrics: { total_interactions: 10 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "p_unranked", providerMediaId: "p", metrics: { reach: 100 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.topPosts.map((r) => r.post.id)).toEqual(["p_ranked"]);
  });

  it("a post never synced is never ranked", async () => {
    writeSocialPosts([post({ id: "p_never_synced" })]);
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.topPosts).toHaveLength(0);
  });
});

describe("getSocialAnalyticsDashboardAction — account trend", () => {
  it("reports no Instagram identity (empty account section) when Meta isn't connected", async () => {
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.instagramAccountId).toBeNull();
    expect(result.data.accountLatest).toBeNull();
    expect(result.data.accountHistory).toEqual([]);
  });

  it("resolves the currently selected Instagram account and returns its history filtered to the range, ascending by metric_date", async () => {
    await connectMetaWithSelectedIdentity();
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: daysAgoDate(1), metrics: { reach: 300 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: daysAgoDate(2), metrics: { reach: 200 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: daysAgoDate(45), metrics: { reach: 999 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction("7d");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.instagramAccountId).toBe("ig_1");
    expect(result.data.accountHistory.map((s) => s.reach)).toEqual([200, 300]);
    expect(result.data.accountLatest?.reach).toBe(300);
  });

  it("preserves a real zero and null distinctly for account metrics", async () => {
    await connectMetaWithSelectedIdentity();
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: daysAgoDate(1), metrics: { reach: 0 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.accountLatest?.reach).toBe(0);
    expect(result.data.accountLatest?.profile_views).toBeNull();
  });
});

describe("getSocialAnalyticsDashboardAction — freshness", () => {
  it("reports the latest snapshot date per section, independent of the selected range", async () => {
    writeSocialPosts([post()]);
    await connectMetaWithSelectedIdentity();
    await mockSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, socialPostId: "post_1", providerMediaId: "p", snapshotDate: daysAgoDate(1), metrics: { reach: 10 }, rawMetrics: {} });
    await mockSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({ workspaceId: CURRENT_WORKSPACE_ID, instagramAccountId: "ig_1", metricDate: daysAgoDate(3), metrics: { reach: 10 }, rawMetrics: {} });

    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.freshness.postAsOf).toBe(daysAgoDate(1));
    expect(result.data.freshness.accountAsOf).toBe(daysAgoDate(3));
  });

  it("reports null freshness when nothing has ever been synced", async () => {
    writeSocialPosts([post()]);
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.freshness.postAsOf).toBeNull();
    expect(result.data.freshness.accountAsOf).toBeNull();
  });
});

describe("getSocialAnalyticsDashboardAction — no data", () => {
  it("returns a fully empty, valid shape for a workspace with zero posts and zero snapshots", async () => {
    const result = await getSocialAnalyticsDashboardAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.postPerformance).toEqual([]);
    expect(result.data.topPosts).toEqual([]);
    expect(result.data.accountHistory).toEqual([]);
  });
});
