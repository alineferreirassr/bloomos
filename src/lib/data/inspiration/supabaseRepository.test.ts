import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseInspirationItemsRepository } from "@/lib/data/inspiration/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateInspirationItemInput } from "@/lib/data/inspiration/repository";

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
    b.is = chain("is");
    b.not = chain("not");
    b.ilike = chain("ilike");
    b.order = chain("order");
    b.range = chain("range");
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

function itemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "insp_1",
    workspace_id: "ws_1",
    title: "A great Reel idea",
    source_type: "instagram",
    source_url: null,
    normalized_source_url: null,
    creator_name: null,
    creator_handle: null,
    platform_content_id: null,
    content_format: null,
    hook: null,
    cta: null,
    why_it_works: null,
    notes: null,
    duration_seconds: null,
    published_at: null,
    media_asset_id: null,
    archived_at: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-19T00:00:00Z",
    updated_at: "2026-09-19T00:00:00Z",
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateInspirationItemInput> = {}): CreateInspirationItemInput {
  return {
    workspaceId: "ws_1",
    createdBy: "11111111-1111-4111-8111-111111111111",
    title: "A great Reel idea",
    sourceType: "instagram",
    sourceUrl: null,
    normalizedSourceUrl: null,
    creatorName: null,
    creatorHandle: null,
    platformContentId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    whyItWorks: null,
    notes: null,
    durationSeconds: null,
    publishedAt: null,
    mediaAssetId: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseInspirationItemsRepository.createInspirationItem", () => {
  it("inserts and maps the row back, preserving created_by as a UUID passthrough", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.createInspirationItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe("11111111-1111-4111-8111-111111111111");

    const insertCall = calls.find((c) => c.table === "inspiration_items" && c.method === "insert");
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.created_by).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.workspace_id).toBe("ws_1");
  });

  it("converts a unique-constraint violation (23505) into a controlled duplicate error, never a raw Postgres error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.createInspirationItem(createInput({ normalizedSourceUrl: "https://instagram.com/reel/abc" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toMatch(/23505|constraint|postgres/i);
  });

  it("preserves null for every unset optional field", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.createInspirationItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.creator_name).toBeNull();
    expect(result.data.media_asset_id).toBeNull();
  });

  it("persists a real zero duration distinctly from null", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ duration_seconds: 0 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.createInspirationItem(createInput({ durationSeconds: 0 }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.duration_seconds).toBe(0);
    const insertCall = calls.find((c) => c.method === "insert");
    expect((insertCall?.args[0] as { duration_seconds: number }).duration_seconds).toBe(0);
  });
});

describe("supabaseInspirationItemsRepository.getInspirationItemById", () => {
  it("returns the mapped item when found", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseInspirationItemsRepository.getInspirationItemById("insp_1");
    expect(item.id).toBe("insp_1");
  });

  it("throws when no row is found — never returns null silently", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseInspirationItemsRepository.getInspirationItemById("missing")).rejects.toThrow();
  });
});

describe("supabaseInspirationItemsRepository.listInspirationItems", () => {
  it("scopes to the workspace, defaults to active-only, orders by created_at desc then id desc, and applies a bounded range", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseInspirationItemsRepository.listInspirationItems("ws_1");
    expect(items).toHaveLength(1);

    expect(calls.some((c) => c.table === "inspiration_items" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "ws_1")).toBe(true);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "archived_at" && c.args[1] === null)).toBe(true);
    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls[0].args[0]).toBe("created_at");
    expect(orderCalls[1].args[0]).toBe("id");
    const rangeCall = calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it("archived: 'archived' uses a not-is-null filter instead of is-null", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInspirationItemsRepository.listInspirationItems("ws_1", { archived: "archived" });
    expect(calls.some((c) => c.method === "not" && c.args[0] === "archived_at" && c.args[1] === "is" && c.args[2] === null)).toBe(true);
    expect(calls.some((c) => c.method === "is")).toBe(false);
  });

  it("archived: 'all' applies neither is nor not filter", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInspirationItemsRepository.listInspirationItems("ws_1", { archived: "all" });
    expect(calls.some((c) => c.method === "is" || c.method === "not")).toBe(false);
  });

  it("filters by source_type and content_format via eq", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInspirationItemsRepository.listInspirationItems("ws_1", { sourceType: "tiktok", contentFormat: "reel" });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "source_type" && c.args[1] === "tiktok")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "content_format" && c.args[1] === "reel")).toBe(true);
  });

  it("escapes ILIKE wildcard characters in a search term so they match literally, not as patterns", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInspirationItemsRepository.listInspirationItems("ws_1", { search: "50% off_deal" });
    const ilikeCall = calls.find((c) => c.method === "ilike");
    expect(ilikeCall?.args).toEqual(["title", "%50\\% off\\_deal%"]);
  });

  it("clamps range to the requested limit/offset", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInspirationItemsRepository.listInspirationItems("ws_1", { limit: 10, offset: 20 });
    const rangeCall = calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([20, 29]);
  });
});

describe("supabaseInspirationItemsRepository.updateInspirationItem", () => {
  it("sends only the provided fields in the update payload", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ title: "Updated" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.updateInspirationItem("insp_1", { title: "Updated" });
    expect(result.success).toBe(true);

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ title: "Updated" });
  });

  it("converts a unique-constraint violation into a controlled duplicate error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "duplicate key" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.updateInspirationItem("insp_1", { normalizedSourceUrl: "https://instagram.com/reel/taken" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseInspirationItemsRepository — archive / unarchive", () => {
  it("archives an item that is currently active", async () => {
    const { client, calls } = createMockSupabase([
      { data: itemRow({ archived_at: null }), error: null }, // fetch existing
      { data: itemRow({ archived_at: "2026-09-19T01:00:00Z" }), error: null }, // update
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.archiveInspirationItem("insp_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).not.toBeNull();
    expect(calls.some((c) => c.method === "update")).toBe(true);
  });

  it("archiving an already-archived item is idempotent — never calls update again", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ archived_at: "2026-09-19T01:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.archiveInspirationItem("insp_1");
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("unarchives an archived item", async () => {
    const { client } = createMockSupabase([
      { data: itemRow({ archived_at: "2026-09-19T01:00:00Z" }), error: null },
      { data: itemRow({ archived_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.unarchiveInspirationItem("insp_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
  });

  it("returns a controlled not-found error rather than throwing when the item does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInspirationItemsRepository.archiveInspirationItem("missing");
    expect(result.success).toBe(false);
  });
});

describe("supabaseInspirationItemsRepository — no secret-bearing fields", () => {
  it("the mapped domain object never carries a token/signed-URL-shaped field", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseInspirationItemsRepository.getInspirationItemById("insp_1");
    expect(JSON.stringify(item)).not.toMatch(/access_token|refresh_token|signed_url|client_secret/i);
  });
});
