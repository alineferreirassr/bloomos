import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseInstagramCommentRepository } from "@/lib/data/instagramComment/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateInstagramCommentInput } from "@/lib/data/instagramComment/repository";

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
    b.insert = chain("insert");
    b.update = chain("update");
    b.eq = chain("eq");
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

function commentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "comment_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_comment_id: "c1",
    external_media_id: "media_1",
    parent_external_comment_id: null,
    external_author_id: "author_1",
    external_author_username: "a_follower",
    content: "Beautiful wedding!",
    status: "active",
    external_created_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stubInput(overrides: Partial<CreateInstagramCommentInput> = {}): CreateInstagramCommentInput {
  return {
    workspaceId: "ws_1",
    instagramAccountIdentityId: "identity_1",
    externalCommentId: "c1",
    externalMediaId: "media_1",
    parentExternalCommentId: null,
    externalAuthorId: "author_1",
    externalAuthorUsername: "a_follower",
    content: "Beautiful wedding!",
    externalCreatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("supabaseInstagramCommentRepository", () => {
  it("createComment inserts the expected payload and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: commentRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.createComment(stubInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "ws_1", instagram_account_identity_id: "identity_1", external_comment_id: "c1" });
  });

  it("createComment maps a unique-violation (23505) to a controlled duplicate error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.createComment(stubInput());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("already been recorded");
  });

  it("getCommentByExternalId filters by identity and external_comment_id", async () => {
    const { client, calls } = createMockSupabase([{ data: commentRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.getCommentByExternalId("identity_1", "c1");
    expect(result).toMatchObject({ external_comment_id: "c1" });
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["instagram_account_identity_id", "identity_1"]);
    expect(eqCalls).toContainEqual(["external_comment_id", "c1"]);
  });

  it("getCommentByExternalId returns null when no row matches", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    expect(await supabaseInstagramCommentRepository.getCommentByExternalId("identity_1", "missing")).toBeNull();
  });

  it("getCommentById — SOCIAL-15C — filters by both id and workspace_id, workspace-scoped at the query level", async () => {
    const { client, calls } = createMockSupabase([{ data: commentRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.getCommentById("comment_1", "ws_1");
    expect(result).toMatchObject({ workspace_id: "ws_1" });
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["id", "comment_1"]);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
  });

  it("getCommentById returns null when no row matches (including a real id in a different workspace)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    expect(await supabaseInstagramCommentRepository.getCommentById("comment_1", "ws_other")).toBeNull();
  });

  it("listCommentsForWorkspace filters by workspace_id", async () => {
    const { client, calls } = createMockSupabase([{ data: [commentRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseInstagramCommentRepository.listCommentsForWorkspace("ws_1");
    expect(results).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
  });

  it("updateCommentStatus updates the status field only", async () => {
    const { client, calls } = createMockSupabase([{ data: commentRow({ status: "removed" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.updateCommentStatus("comment_1", "removed");
    expect(result.success && result.data.status).toBe("removed");
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ status: "removed" });
  });

  it("updateCommentStatus maps a not-found (PGRST116) to a controlled error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "PGRST116" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramCommentRepository.updateCommentStatus("missing", "removed");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("This Instagram comment could not be found.");
  });
});
