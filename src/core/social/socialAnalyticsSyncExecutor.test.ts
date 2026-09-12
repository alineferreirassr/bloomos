import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServiceRoleClientMock = vi.fn();
const resolveWorkspaceAnalyticsContextMock = vi.fn();
vi.mock("@/core/social/socialAnalyticsServiceRole", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClientMock(...args),
  resolveWorkspaceAnalyticsContext: (...args: unknown[]) => resolveWorkspaceAnalyticsContextMock(...args),
}));

import { runSocialAnalyticsSyncBatch } from "@/core/social/socialAnalyticsSyncExecutor";
import { MetaProvider } from "@/core/integrations/providers/meta/metaProvider";

type QueueResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueueResult[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  function next(): QueueResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.eq = chain("eq");
    b.not = chain("not");
    b.upsert = (...args: unknown[]) => {
      calls.push({ table, method: "upsert", args });
      return next();
    };
    b.then = (resolve: (v: QueueResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(next());
    };
    return b;
  }
  return { from: (table: string) => builder(table), calls };
}

function socialPostRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
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
}

const VALID_CONTEXT = { success: true as const, context: { connectionId: "conn_1", instagramAccountId: "ig_1", accessToken: "real-token" } };

beforeEach(() => {
  createServiceRoleClientMock.mockReset();
  resolveWorkspaceAnalyticsContextMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSocialAnalyticsSyncBatch — orchestration", () => {
  it("fails closed when the service-role client is unavailable, before any Meta call", async () => {
    createServiceRoleClientMock.mockReturnValue(null);
    const result = await runSocialAnalyticsSyncBatch();
    expect(result).toEqual({ success: false, reason: "service_role_unavailable" });
    expect(resolveWorkspaceAnalyticsContextMock).not.toHaveBeenCalled();
  });

  it("reports connections_lookup_failed without touching any workspace when the connections query itself errors", async () => {
    const supabase = createMockSupabase([{ data: null, error: { message: "db down" } }]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    const result = await runSocialAnalyticsSyncBatch();
    expect(result).toEqual({ success: false, reason: "connections_lookup_failed" });
  });

  it("considers zero workspaces and reports an empty summary when no Meta connection is connected anywhere", async () => {
    const supabase = createMockSupabase([{ data: [], error: null }]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    const result = await runSocialAnalyticsSyncBatch();
    expect(result).toEqual({ success: true, summary: { workspacesConsidered: 0, postsConsidered: 0, postSnapshotsUpserted: 0, accountSnapshotsUpserted: 0, skipped: 0, retryableFailures: 0, terminalFailures: 0 } });
  });

  it("syncs the account snapshot then the eligible published post, upserting both — filtering on status=published and provider_post_id not null", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null }, // 1. connections list
      { data: null, error: null }, // 2. account snapshot upsert
      { data: [socialPostRow()], error: null }, // 3. published posts for ws_1
      { data: null, error: null }, // 4. post snapshot upsert
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }]);

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary).toEqual({ workspacesConsidered: 1, postsConsidered: 1, postSnapshotsUpserted: 1, accountSnapshotsUpserted: 1, skipped: 0, retryableFailures: 0, terminalFailures: 0 });

    const postsQueryFilter = supabase.calls.find((c) => c.table === "social_posts" && c.method === "eq" && c.args[0] === "status");
    expect(postsQueryFilter?.args).toEqual(["status", "published"]);
    const notFilter = supabase.calls.find((c) => c.table === "social_posts" && c.method === "not");
    expect(notFilter?.args).toEqual(["provider_post_id", "is", null]);

    const accountUpsert = supabase.calls.find((c) => c.table === "social_account_metric_snapshots" && c.method === "upsert");
    const accountPayload = accountUpsert?.args[0] as { reach: number | null; profile_views: number | null };
    expect(accountPayload.reach).toBe(500);
    expect(accountPayload.profile_views).toBeNull();

    const postUpsert = supabase.calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    const postPayload = postUpsert?.args[0] as { social_post_id: string; reach: number | null };
    expect(postPayload.social_post_id).toBe("post_1");
    expect(postPayload.reach).toBe(120);
  });

  it("skips (does not fail) account sync when no Instagram identity has been selected yet, but still syncs eligible posts", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: [socialPostRow()], error: null },
      { data: null, error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue({ success: true, context: { connectionId: "conn_1", instagramAccountId: null, accessToken: "real-token" } });
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }]);

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.accountSnapshotsUpserted).toBe(0);
    expect(result.summary.postSnapshotsUpserted).toBe(1);
  });

  it("a connection/credential failure for one workspace is a terminal failure for that workspace only, and other work still runs when there is another workspace", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_broken", workspace_id: "ws_broken" }, { id: "conn_1", workspace_id: "ws_1" }], error: null },
      // ws_broken: resolveWorkspaceAnalyticsContext fails, no supabase calls made for it
      { data: null, error: null }, // ws_1 account upsert
      { data: [socialPostRow()], error: null }, // ws_1 posts
      { data: null, error: null }, // ws_1 post upsert
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockImplementation(async (workspaceId: string) => {
      if (workspaceId === "ws_broken") return { success: false, reason: "connection" };
      return VALID_CONTEXT;
    });
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }]);

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.workspacesConsidered).toBe(2);
    expect(result.summary.terminalFailures).toBe(1); // ws_broken only
    expect(result.summary.postSnapshotsUpserted).toBe(1); // ws_1 still ran
    expect(result.summary.accountSnapshotsUpserted).toBe(1);
  });

  it("one post's failure does not abort a sibling post in the same workspace", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null }, // account upsert
      { data: [socialPostRow({ id: "post_fails", provider_post_id: "media_fails" }), socialPostRow({ id: "post_2", provider_post_id: "media_2" })], error: null },
      { data: null, error: null }, // post_2's successful upsert (post_fails never reaches upsert)
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    const mediaInsightsSpy = vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights");
    mediaInsightsSpy.mockImplementation(async (mediaId: string) => {
      if (mediaId === "media_fails") throw new Error("Meta Graph API error 400: media not found");
      return [{ metric: "reach", value: 120 }];
    });

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.postsConsidered).toBe(2);
    expect(result.summary.postSnapshotsUpserted).toBe(1);
    expect(result.summary.terminalFailures).toBe(1);
  });

  it("a Meta rate-limit error on a post is classified retryable, not terminal, and does not abort the batch", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null },
      { data: [socialPostRow()], error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockRejectedValue(new Error('Meta Graph API error 400: {"error":{"message":"(#4) Application request limit reached","code":4}}'));

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.retryableFailures).toBe(1);
    expect(result.summary.terminalFailures).toBe(0);
  });

  it("an auth error on the account call is terminal and never wipes/mutates anything else", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: [socialPostRow()], error: null },
      { data: null, error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockRejectedValue(new Error('Meta Graph API error 401: {"error":{"message":"Invalid OAuth access token.","code":190}}'));
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }]);

    const result = await runSocialAnalyticsSyncBatch();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.terminalFailures).toBe(1); // the account failure only
    expect(result.summary.postSnapshotsUpserted).toBe(1); // posts still synced independently
  });

  it("running the same logical sync twice upserts on the exact same idempotency keys — no duplicate row is ever implied by the payload shape", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null },
      { data: [socialPostRow()], error: null },
      { data: null, error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }]);

    await runSocialAnalyticsSyncBatch();

    const postUpsert = supabase.calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    expect(postUpsert?.args[1]).toEqual({ onConflict: "social_post_id,snapshot_date" });
    const accountUpsert = supabase.calls.find((c) => c.table === "social_account_metric_snapshots" && c.method === "upsert");
    expect(accountUpsert?.args[1]).toEqual({ onConflict: "workspace_id,instagram_account_id,metric_date" });
  });

  it("preserves null for a missing metric and a real zero distinctly", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null },
      { data: [socialPostRow()], error: null },
      { data: null, error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 0 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "likes", value: 0 }]);

    await runSocialAnalyticsSyncBatch();

    const accountUpsert = supabase.calls.find((c) => c.table === "social_account_metric_snapshots" && c.method === "upsert");
    const accountPayload = accountUpsert?.args[0] as { reach: number | null; profile_views: number | null };
    expect(accountPayload.reach).toBe(0);
    expect(accountPayload.profile_views).toBeNull();

    const postUpsert = supabase.calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    const postPayload = postUpsert?.args[0] as { likes: number | null; reach: number | null };
    expect(postPayload.likes).toBe(0);
    expect(postPayload.reach).toBeNull();
  });

  it("preserves an unknown raw metric Meta returned in raw_metrics on both snapshot types", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null },
      { data: [socialPostRow()], error: null },
      { data: null, error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }, { metric: "follower_count", value: 999 }]);
    vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights").mockResolvedValue([{ metric: "reach", value: 120 }, { metric: "some_future_metric", value: 7 }]);

    await runSocialAnalyticsSyncBatch();

    const accountUpsert = supabase.calls.find((c) => c.table === "social_account_metric_snapshots" && c.method === "upsert");
    const accountPayload = accountUpsert?.args[0] as { raw_metrics: Record<string, number> };
    expect(accountPayload.raw_metrics.follower_count).toBe(999);

    const postUpsert = supabase.calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    const postPayload = postUpsert?.args[0] as { raw_metrics: Record<string, number> };
    expect(postPayload.raw_metrics.some_future_metric).toBe(7);
  });

  it("never invokes MetaProvider for a post lacking provider_post_id even if one somehow reached this stage", async () => {
    const supabase = createMockSupabase([
      { data: [{ id: "conn_1", workspace_id: "ws_1" }], error: null },
      { data: null, error: null },
      { data: [socialPostRow({ provider_post_id: null })], error: null },
    ]);
    createServiceRoleClientMock.mockReturnValue(supabase);
    resolveWorkspaceAnalyticsContextMock.mockResolvedValue(VALID_CONTEXT);
    vi.spyOn(MetaProvider.prototype, "getInstagramAccountInsights").mockResolvedValue([{ metric: "reach", value: 500 }]);
    const mediaInsightsSpy = vi.spyOn(MetaProvider.prototype, "getInstagramMediaInsights");

    const result = await runSocialAnalyticsSyncBatch();
    expect(mediaInsightsSpy).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.terminalFailures).toBe(1);
  });
});

