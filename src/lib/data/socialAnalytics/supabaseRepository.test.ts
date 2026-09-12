import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseSocialAnalyticsRepository } from "@/lib/data/socialAnalytics/supabaseRepository";
import { createClient } from "@/lib/supabase/client";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  function nextResult(): QueryResult {
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
    b.in = chain("in");
    b.order = chain("order");
    b.upsert = chain("upsert");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

function postSnapshotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "snap_1",
    workspace_id: "workspace_1",
    social_post_id: "social_post_1",
    provider_media_id: "17900000000000001",
    captured_at: "2026-09-17T00:00:00Z",
    snapshot_date: "2026-09-17",
    views: null,
    reach: 120,
    likes: 10,
    comments: null,
    shares: null,
    saved: null,
    total_interactions: null,
    raw_metrics: { reach: 120, likes: 10 },
    created_at: "2026-09-17T00:00:00Z",
    ...overrides,
  };
}

function accountSnapshotRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "acct_snap_1",
    workspace_id: "workspace_1",
    instagram_account_id: "ig_1",
    metric_date: "2026-09-17",
    reach: 500,
    profile_views: null,
    raw_metrics: { reach: 500 },
    created_at: "2026-09-17T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseSocialAnalyticsRepository.upsertSocialPostMetricSnapshot", () => {
  it("verifies the post belongs to the caller's own workspace before upserting", async () => {
    const { client, calls } = createMockSupabase([
      { data: { id: "social_post_1" }, error: null }, // ownership check
      { data: postSnapshotRow(), error: null }, // upsert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: "workspace_1",
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 120, likes: 10 },
      rawMetrics: { reach: 120, likes: 10 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reach).toBe(120);

    const ownershipCheck = calls.find((c) => c.table === "social_posts" && c.method === "eq");
    expect(ownershipCheck).toBeDefined();
    const upsertCall = calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    expect(upsertCall).toBeDefined();
    expect((upsertCall?.args[1] as { onConflict: string }).onConflict).toBe("social_post_id,snapshot_date");
  });

  it("rejects when the post does not belong to the given workspace, without ever calling upsert", async () => {
    const { client, calls } = createMockSupabase([{ data: null, error: null }]); // ownership check fails
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: "workspace_1",
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: {},
      rawMetrics: {},
    });
    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "upsert")).toBe(false);
  });

  it("preserves null for an absent metric — never sends a fabricated zero", async () => {
    const { client, calls } = createMockSupabase([
      { data: { id: "social_post_1" }, error: null },
      { data: postSnapshotRow({ likes: null, views: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: "workspace_1",
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 120 },
      rawMetrics: { reach: 120 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.likes).toBeNull();
    expect(result.data.views).toBeNull();

    const upsertCall = calls.find((c) => c.table === "social_post_metric_snapshots" && c.method === "upsert");
    const payload = upsertCall?.args[0] as { likes: number | null; views: number | null };
    expect(payload.likes).toBeNull();
    expect(payload.views).toBeNull();
  });

  it("preserves an unknown raw metric this schema has no typed column for", async () => {
    const { client } = createMockSupabase([
      { data: { id: "social_post_1" }, error: null },
      { data: postSnapshotRow({ raw_metrics: { reach: 120, some_future_metric: 42 } }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialAnalyticsRepository.upsertSocialPostMetricSnapshot({
      workspaceId: "workspace_1",
      socialPostId: "social_post_1",
      providerMediaId: "17900000000000001",
      metrics: { reach: 120 },
      rawMetrics: { reach: 120, some_future_metric: 42 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.raw_metrics.some_future_metric).toBe(42);
  });
});

describe("supabaseSocialAnalyticsRepository — post snapshot list/latest", () => {
  it("scopes list to the given workspace and post, ordered by snapshot_date descending", async () => {
    const { client, calls } = createMockSupabase([{ data: [postSnapshotRow({ snapshot_date: "2026-09-17" }), postSnapshotRow({ id: "snap_0", snapshot_date: "2026-09-16" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const history = await supabaseSocialAnalyticsRepository.listSocialPostMetricSnapshots("workspace_1", "social_post_1");
    expect(history).toHaveLength(2);
    expect(history[0].snapshot_date).toBe("2026-09-17");

    const orderCall = calls.find((c) => c.method === "order");
    expect(orderCall?.args[0]).toBe("snapshot_date");
  });

  it("getLatestSocialPostMetricSnapshot returns the first (newest) row, or null when empty", async () => {
    const { client } = createMockSupabase([{ data: [postSnapshotRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const latest = await supabaseSocialAnalyticsRepository.getLatestSocialPostMetricSnapshot("workspace_1", "social_post_1");
    expect(latest?.id).toBe("snap_1");
  });

  it("getLatestSocialPostMetricSnapshot returns null when history is empty", async () => {
    const { client } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const latest = await supabaseSocialAnalyticsRepository.getLatestSocialPostMetricSnapshot("workspace_1", "social_post_1");
    expect(latest).toBeNull();
  });

  describe("listLatestSocialPostMetricSnapshotsForWorkspace — SOCIAL-05E batch read", () => {
    it("reduces to exactly one (latest) row per post from a single query — no N+1", async () => {
      const { client, calls } = createMockSupabase([
        {
          data: [
            postSnapshotRow({ id: "snap_p1_new", social_post_id: "social_post_1", snapshot_date: "2026-09-17" }),
            postSnapshotRow({ id: "snap_p1_old", social_post_id: "social_post_1", snapshot_date: "2026-09-15" }),
            postSnapshotRow({ id: "snap_p2", social_post_id: "social_post_2", snapshot_date: "2026-09-16", reach: 99 }),
          ],
          error: null,
        },
      ]);
      vi.mocked(createClient).mockReturnValue(client as never);

      const results = await supabaseSocialAnalyticsRepository.listLatestSocialPostMetricSnapshotsForWorkspace("workspace_1", ["social_post_1", "social_post_2"]);
      expect(results).toHaveLength(2);
      const byPost = new Map(results.map((r) => [r.social_post_id, r]));
      expect(byPost.get("social_post_1")?.id).toBe("snap_p1_new");
      expect(byPost.get("social_post_2")?.reach).toBe(99);

      const inCall = calls.find((c) => c.method === "in");
      expect(inCall?.args).toEqual(["social_post_id", ["social_post_1", "social_post_2"]]);
      // Exactly one query for the whole batch — the harness would throw
      // "no mock response queued" on a second call, which itself proves no N+1.
      expect(calls.filter((c) => c.method === "then")).toHaveLength(1);
    });

    it("returns an empty array without querying Supabase at all when given no post ids", async () => {
      const { client, calls } = createMockSupabase([]);
      vi.mocked(createClient).mockReturnValue(client as never);
      const results = await supabaseSocialAnalyticsRepository.listLatestSocialPostMetricSnapshotsForWorkspace("workspace_1", []);
      expect(results).toEqual([]);
      expect(calls).toHaveLength(0);
    });
  });
});

describe("supabaseSocialAnalyticsRepository — account snapshots", () => {
  it("upserts on the (workspace_id, instagram_account_id, metric_date) conflict key", async () => {
    const { calls, client } = createMockSupabase([{ data: accountSnapshotRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialAnalyticsRepository.upsertSocialAccountMetricSnapshot({
      workspaceId: "workspace_1",
      instagramAccountId: "ig_1",
      metricDate: "2026-09-17",
      metrics: { reach: 500 },
      rawMetrics: { reach: 500 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.reach).toBe(500);
    expect(result.data.profile_views).toBeNull();

    const upsertCall = calls.find((c) => c.table === "social_account_metric_snapshots" && c.method === "upsert");
    expect((upsertCall?.args[1] as { onConflict: string }).onConflict).toBe("workspace_id,instagram_account_id,metric_date");
  });

  it("lists account history ordered by metric_date descending and exposes the latest", async () => {
    const { client } = createMockSupabase([{ data: [accountSnapshotRow({ metric_date: "2026-09-17" }), accountSnapshotRow({ id: "acct_snap_0", metric_date: "2026-09-16" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const history = await supabaseSocialAnalyticsRepository.listSocialAccountMetricSnapshots("workspace_1", "ig_1");
    expect(history.map((s) => s.metric_date)).toEqual(["2026-09-17", "2026-09-16"]);
  });
});

describe("supabaseSocialAnalyticsRepository — no secret-bearing fields", () => {
  it("the mapped domain object never carries a token/signed-URL-shaped field", async () => {
    const { client } = createMockSupabase([{ data: [postSnapshotRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const latest = await supabaseSocialAnalyticsRepository.getLatestSocialPostMetricSnapshot("workspace_1", "social_post_1");
    expect(JSON.stringify(latest)).not.toMatch(/access_token|refresh_token|signed_url|client_secret/i);
  });
});
