import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseIdeaItemsRepository } from "@/lib/data/idea/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateIdeaItemInput } from "@/lib/data/idea/repository";

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
    id: "idea_1",
    workspace_id: "ws_1",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    status: "active",
    source_inspiration_id: null,
    content_format: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    media_asset_id: null,
    priority: null,
    archived_at: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-20T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateIdeaItemInput> = {}): CreateIdeaItemInput {
  return {
    workspaceId: "ws_1",
    createdBy: "11111111-1111-4111-8111-111111111111",
    title: "Behind the scenes at a spring wedding",
    description: "A short reel following setup to first dance.",
    sourceInspirationId: null,
    contentFormat: null,
    hook: null,
    cta: null,
    audience: null,
    notes: null,
    mediaAssetId: null,
    priority: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseIdeaItemsRepository.createIdeaItem", () => {
  it("inserts and maps the row back, preserving created_by as a UUID passthrough", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.createIdeaItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.created_by).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.data.status).toBe("active");

    const insertCall = calls.find((c) => c.table === "idea_items" && c.method === "insert");
    expect(insertCall).toBeDefined();
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.created_by).toBe("11111111-1111-4111-8111-111111111111");
    expect(payload.workspace_id).toBe("ws_1");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("archived_at");
  });

  it("preserves null for every unset optional field", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.createIdeaItem(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBeNull();
    expect(result.data.media_asset_id).toBeNull();
    expect(result.data.priority).toBeNull();
  });

  it("persists a valid source_inspiration_id and priority", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ source_inspiration_id: "insp_1", priority: "high" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.createIdeaItem(createInput({ sourceInspirationId: "insp_1", priority: "high" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_inspiration_id).toBe("insp_1");
    expect(result.data.priority).toBe("high");
    const insertCall = calls.find((c) => c.method === "insert");
    expect((insertCall?.args[0] as { source_inspiration_id: string }).source_inspiration_id).toBe("insp_1");
  });
});

describe("supabaseIdeaItemsRepository.getIdeaItemById", () => {
  it("returns the mapped item when found", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseIdeaItemsRepository.getIdeaItemById("idea_1");
    expect(item.id).toBe("idea_1");
  });

  it("throws when no row is found — never returns null silently", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseIdeaItemsRepository.getIdeaItemById("missing")).rejects.toThrow();
  });
});

describe("supabaseIdeaItemsRepository.listIdeaItems", () => {
  it("scopes to the workspace, defaults to active-only via the status column, orders by created_at desc then id desc, and applies a bounded range", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseIdeaItemsRepository.listIdeaItems("ws_1");
    expect(items).toHaveLength(1);

    expect(calls.some((c) => c.table === "idea_items" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "ws_1")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "active")).toBe(true);
    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls[0].args[0]).toBe("created_at");
    expect(orderCalls[1].args[0]).toBe("id");
    const rangeCall = calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it("archived: 'archived' filters status = archived", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseIdeaItemsRepository.listIdeaItems("ws_1", { archived: "archived" });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "archived")).toBe(true);
  });

  it("archived: 'all' applies no status filter", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseIdeaItemsRepository.listIdeaItems("ws_1", { archived: "all" });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status")).toBe(false);
  });

  it("escapes ILIKE wildcard characters in a search term so they match literally, not as patterns", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseIdeaItemsRepository.listIdeaItems("ws_1", { search: "50% off_deal" });
    const ilikeCall = calls.find((c) => c.method === "ilike");
    expect(ilikeCall?.args).toEqual(["title", "%50\\% off\\_deal%"]);
  });

  it("clamps range to the requested limit/offset", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseIdeaItemsRepository.listIdeaItems("ws_1", { limit: 10, offset: 20 });
    const rangeCall = calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([20, 29]);
  });
});

describe("supabaseIdeaItemsRepository.updateIdeaItem", () => {
  it("sends only the provided fields in the update payload", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ title: "Updated" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.updateIdeaItem("idea_1", { title: "Updated" });
    expect(result.success).toBe(true);

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ title: "Updated" });
  });

  it("returns a controlled not-found error rather than throwing on PGRST116", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "PGRST116", message: "no rows" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.updateIdeaItem("missing", { title: "X" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseIdeaItemsRepository — archive / unarchive", () => {
  it("archives an item that is currently active, setting status and archived_at together", async () => {
    const { client, calls } = createMockSupabase([
      { data: itemRow({ status: "active", archived_at: null }), error: null }, // fetch existing
      { data: itemRow({ status: "archived", archived_at: "2026-09-20T01:00:00Z" }), error: null }, // update
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.archiveIdeaItem("idea_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    expect(result.data.archived_at).not.toBeNull();
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toMatchObject({ status: "archived" });
  });

  it("archiving an already-archived item is idempotent — never calls update again", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ status: "archived", archived_at: "2026-09-20T01:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.archiveIdeaItem("idea_1");
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("unarchives an archived item, restoring status and clearing archived_at", async () => {
    const { client } = createMockSupabase([
      { data: itemRow({ status: "archived", archived_at: "2026-09-20T01:00:00Z" }), error: null },
      { data: itemRow({ status: "active", archived_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.unarchiveIdeaItem("idea_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");
    expect(result.data.archived_at).toBeNull();
  });

  it("returns a controlled not-found error rather than throwing when the item does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseIdeaItemsRepository.archiveIdeaItem("missing");
    expect(result.success).toBe(false);
  });
});

describe("supabaseIdeaItemsRepository — no secret-bearing fields", () => {
  it("the mapped domain object never carries a token/signed-URL-shaped field", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseIdeaItemsRepository.getIdeaItemById("idea_1");
    expect(JSON.stringify(item)).not.toMatch(/access_token|refresh_token|signed_url|client_secret/i);
  });
});
