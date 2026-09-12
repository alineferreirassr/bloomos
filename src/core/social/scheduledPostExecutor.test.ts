import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createServiceRoleClientMock = vi.fn();
const resolveSocialSchedulerContextMock = vi.fn();
vi.mock("@/core/social/socialSchedulerServiceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
  resolveSocialSchedulerContext: (post: unknown) => resolveSocialSchedulerContextMock(post),
}));

import { runScheduledSocialPostBatch } from "@/core/social/scheduledPostExecutor";
import { MAX_PUBLISH_ATTEMPTS } from "@/core/social/socialSchedulingPolicy";

interface Row {
  [key: string]: unknown;
}

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
    status: "publishing",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: null,
    provider_permalink: null,
    provider_error: null,
    published_at: null,
    scheduled_at: "2026-01-01T00:00:00Z",
    scheduled_timezone: null,
    publish_attempts: 1,
    next_attempt_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** A tiny in-memory `social_posts` table so `updateSocialPostServiceRole`'s update().eq().select().maybeSingle() chain behaves like a real round-trip: the patch is merged and the merged row is what a subsequent read/update sees. */
function makeFakeClient(claimedRows: Row[], reclaimedCount = 0) {
  const rows = new Map(claimedRows.map((row) => [row.id as string, { ...row }]));
  const updateCalls: { id: string; patch: Row }[] = [];

  const rpc = vi.fn(async (name: string) => {
    if (name === "reclaim_abandoned_social_posts") return { data: reclaimedCount, error: null };
    if (name === "claim_due_social_posts") return { data: claimedRows, error: null };
    throw new Error(`Unexpected RPC: ${name}`);
  });

  const from = vi.fn((table: string) => {
    if (table !== "social_posts") throw new Error(`Unexpected table: ${table}`);
    let targetId = "";
    let pendingPatch: Row = {};
    const builder: Record<string, unknown> = {};
    builder.update = vi.fn((patch: Row) => {
      pendingPatch = patch;
      return builder;
    });
    builder.eq = vi.fn((_col: string, value: string) => {
      targetId = value;
      return builder;
    });
    builder.select = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => {
      const existing = rows.get(targetId);
      if (!existing) return { data: null, error: { message: "not found" } };
      const updated = { ...existing, ...pendingPatch };
      rows.set(targetId, updated);
      updateCalls.push({ id: targetId, patch: pendingPatch });
      return { data: updated, error: null };
    });
    return builder;
  });

  return { rpc, from, updateCalls, rows };
}

beforeEach(() => {
  createServiceRoleClientMock.mockReset();
  resolveSocialSchedulerContextMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runScheduledSocialPostBatch", () => {
  it("fails closed when the service-role client is unavailable, without calling any RPC", async () => {
    createServiceRoleClientMock.mockReturnValue(null);
    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: false, reason: "service_role_unavailable" });
  });

  it("reports reclaim_failed when the lease-recovery RPC errors", async () => {
    const client = { rpc: vi.fn(async () => ({ data: null, error: { message: "db error" } })), from: vi.fn() };
    createServiceRoleClientMock.mockReturnValue(client);
    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: false, reason: "reclaim_failed" });
  });

  it("reports claim_failed when the claim RPC errors", async () => {
    const client = {
      rpc: vi.fn(async (name: string) => (name === "reclaim_abandoned_social_posts" ? { data: 0, error: null } : { data: null, error: { message: "db error" } })),
      from: vi.fn(),
    };
    createServiceRoleClientMock.mockReturnValue(client);
    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: false, reason: "claim_failed" });
  });

  it("returns a clean zero-claimed summary when nothing is due", async () => {
    const client = makeFakeClient([], 2);
    createServiceRoleClientMock.mockReturnValue(client);
    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: true, summary: { reclaimed: 2, claimed: 0, published: 0, failedRetryable: 0, failedTerminal: 0 } });
  });

  it("SOCIAL-04A Phase 12/16 — a connection/credential/asset resolution failure is always terminal, never retried", async () => {
    const row = baseRow();
    const client = makeFakeClient([row]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockResolvedValue({ success: false, failure: { kind: "connection", message: "Reconnect Meta to enable publishing." } });

    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: true, summary: { reclaimed: 0, claimed: 1, published: 0, failedRetryable: 0, failedTerminal: 1 } });

    const finalRow = client.rows.get("post_1");
    expect(finalRow?.status).toBe("failed");
    expect(finalRow?.next_attempt_at).toBeNull();
    expect(finalRow?.provider_error).toBe("Reconnect Meta to enable publishing.");
  });

  it("publishes successfully end-to-end through the real executeSocialPostPublish mechanics (mocked Meta fetch)", async () => {
    const row = baseRow();
    const client = makeFakeClient([row]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockResolvedValue({ success: true, accessToken: "fake-token", imageUrl: "https://signed.example/image.jpg" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_x" }), { status: 200 });
        if (input.pathname.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "ig_media_x" }), { status: 200 });
        return new Response(JSON.stringify({ permalink: "https://instagram.com/p/xyz" }), { status: 200 });
      }),
    );

    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: true, summary: { reclaimed: 0, claimed: 1, published: 1, failedRetryable: 0, failedTerminal: 0 } });

    const finalRow = client.rows.get("post_1");
    expect(finalRow?.status).toBe("published");
    expect(finalRow?.provider_post_id).toBe("ig_media_x");
    vi.unstubAllGlobals();
  });

  it("SOCIAL-04A Phase 9 — a retryable Meta failure with attempts remaining schedules a future next_attempt_at", async () => {
    const row = baseRow({ publish_attempts: 1 });
    const client = makeFakeClient([row]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockResolvedValue({ success: true, accessToken: "fake-token", imageUrl: "https://signed.example/image.jpg" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_x" }), { status: 200 });
        return new Response("upstream unavailable", { status: 503 });
      }),
    );

    const before = Date.now();
    const result = await runScheduledSocialPostBatch();
    expect(result.success && result.summary.failedRetryable).toBe(1);

    const finalRow = client.rows.get("post_1");
    expect(finalRow?.status).toBe("failed");
    expect(finalRow?.next_attempt_at).not.toBeNull();
    expect(new Date(finalRow?.next_attempt_at as string).getTime()).toBeGreaterThan(before);
    vi.unstubAllGlobals();
  });

  it("SOCIAL-04A Phase 9 — exhausting MAX_PUBLISH_ATTEMPTS on a retryable failure is terminal (next_attempt_at null)", async () => {
    const row = baseRow({ publish_attempts: MAX_PUBLISH_ATTEMPTS });
    const client = makeFakeClient([row]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockResolvedValue({ success: true, accessToken: "fake-token", imageUrl: "https://signed.example/image.jpg" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_x" }), { status: 200 });
        return new Response("upstream unavailable", { status: 503 });
      }),
    );

    const result = await runScheduledSocialPostBatch();
    expect(result.success && result.summary.failedTerminal).toBe(1);

    const finalRow = client.rows.get("post_1");
    expect(finalRow?.status).toBe("failed");
    expect(finalRow?.next_attempt_at).toBeNull();
    vi.unstubAllGlobals();
  });

  it("SOCIAL-04A Phase 18 — a post reclaimed with an existing provider_container_id refuses to republish (terminal, unsafe_retry)", async () => {
    const row = baseRow({ provider_container_id: "container_from_before" });
    const client = makeFakeClient([row]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockResolvedValue({ success: true, accessToken: "fake-token", imageUrl: "https://signed.example/image.jpg" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await runScheduledSocialPostBatch();
    expect(result.success && result.summary.failedTerminal).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();

    const finalRow = client.rows.get("post_1");
    expect(finalRow?.provider_container_id).toBe("container_from_before"); // preserved, never cleared
    vi.unstubAllGlobals();
  });

  it("processes a batch of multiple claimed posts independently", async () => {
    const rowA = baseRow({ id: "post_a" });
    const rowB = baseRow({ id: "post_b" });
    const client = makeFakeClient([rowA, rowB]);
    createServiceRoleClientMock.mockReturnValue(client);
    resolveSocialSchedulerContextMock.mockImplementation(async (post: { id: string }) =>
      post.id === "post_a"
        ? { success: true, accessToken: "fake-token", imageUrl: "https://signed.example/a.jpg" }
        : { success: false, failure: { kind: "asset", message: "That image could not be found." } },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        if (input.pathname.endsWith("/media")) return new Response(JSON.stringify({ id: "container_a" }), { status: 200 });
        if (input.pathname.endsWith("/media_publish")) return new Response(JSON.stringify({ id: "ig_media_a" }), { status: 200 });
        return new Response(JSON.stringify({ permalink: null }), { status: 200 });
      }),
    );

    const result = await runScheduledSocialPostBatch();
    expect(result).toEqual({ success: true, summary: { reclaimed: 0, claimed: 2, published: 1, failedRetryable: 0, failedTerminal: 1 } });
    vi.unstubAllGlobals();
  });
});
