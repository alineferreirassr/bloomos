import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseSocialPostsRepository } from "@/lib/data/socialPosts/supabaseRepository";
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
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

function postRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: null,
    status: "published",
    caption: "Behind the scenes",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_account_1",
    provider_container_id: null,
    provider_post_id: "meta_media_123",
    provider_permalink: null,
    provider_error: null,
    published_at: "2026-09-01T00:00:00.000Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("supabaseSocialPostsRepository.getSocialPostByProviderPostId — SOCIAL-15B", () => {
  it("filters by both workspace_id and provider_post_id — the join is workspace-scoped at the query level, not just in application code", async () => {
    const { client, calls } = createMockSupabase([{ data: postRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_123");
    expect(result?.id).toBe("post_1");

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(eqCalls).toContainEqual({ table: "social_posts", method: "eq", args: ["workspace_id", "ws_1"] });
    expect(eqCalls).toContainEqual({ table: "social_posts", method: "eq", args: ["provider_post_id", "meta_media_123"] });
  });

  it("returns null when no row matches", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseSocialPostsRepository.getSocialPostByProviderPostId("ws_1", "meta_media_does_not_exist");
    expect(result).toBeNull();
  });
});
