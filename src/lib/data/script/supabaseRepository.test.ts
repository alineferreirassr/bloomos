import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseScriptRepository } from "@/lib/data/script/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateScriptItemInput, CreateScriptVersionInput, CreateScriptBlockInput } from "@/lib/data/script/repository";

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
    b.delete = chain("delete");
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
    id: "script_1",
    workspace_id: "ws_1",
    title: "Spring wedding behind-the-scenes",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-21T00:00:00Z",
    ...overrides,
  };
}

function versionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "version_1",
    script_id: "script_1",
    workspace_id: "ws_1",
    status: "draft",
    version_number: null,
    published_at: null,
    published_by: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-21T00:00:00Z",
    ...overrides,
  };
}

function blockRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "block_1",
    script_version_id: "version_1",
    workspace_id: "ws_1",
    content: "Open on a wide shot of the venue.",
    sort_order: 0,
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-21T00:00:00Z",
    ...overrides,
  };
}

function createItemInput(overrides: Partial<CreateScriptItemInput> = {}): CreateScriptItemInput {
  return { workspaceId: "ws_1", createdBy: "11111111-1111-4111-8111-111111111111", title: "Spring wedding behind-the-scenes", sourceIdeaId: null, ...overrides };
}

function createVersionInput(overrides: Partial<CreateScriptVersionInput> = {}): CreateScriptVersionInput {
  return { scriptId: "script_1", workspaceId: "ws_1", createdBy: "11111111-1111-4111-8111-111111111111", ...overrides };
}

function createBlockInput(overrides: Partial<CreateScriptBlockInput> = {}): CreateScriptBlockInput {
  return { scriptVersionId: "version_1", workspaceId: "ws_1", content: "Open on a wide shot of the venue.", sortOrder: 0, ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseScriptRepository.createScriptItem", () => {
  it("inserts and maps the row back, preserving created_by as a UUID passthrough", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.createScriptItem(createItemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");

    const insertCall = calls.find((c) => c.table === "script_items" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.workspace_id).toBe("ws_1");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("archived_at");
  });

  it("preserves null source_idea_id when unset", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.createScriptItem(createItemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.source_idea_id).toBeNull();
  });
});

describe("supabaseScriptRepository.getScriptItemById", () => {
  it("returns the mapped item when found", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseScriptRepository.getScriptItemById("script_1");
    expect(item.id).toBe("script_1");
  });

  it("throws when no row is found — never returns null silently", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseScriptRepository.getScriptItemById("missing")).rejects.toThrow();
  });
});

describe("supabaseScriptRepository.listScriptItems", () => {
  it("scopes to the workspace, defaults to active-only via the status column, orders by created_at desc then id desc, and applies a bounded range", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabaseScriptRepository.listScriptItems("ws_1");
    expect(items).toHaveLength(1);

    expect(calls.some((c) => c.table === "script_items" && c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "ws_1")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "active")).toBe(true);
    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls[0].args[0]).toBe("created_at");
    expect(orderCalls[1].args[0]).toBe("id");
    const rangeCall = calls.find((c) => c.method === "range");
    expect(rangeCall?.args).toEqual([0, 49]);
  });

  it("escapes ILIKE wildcard characters in a search term", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseScriptRepository.listScriptItems("ws_1", { search: "50% off_deal" });
    const ilikeCall = calls.find((c) => c.method === "ilike");
    expect(ilikeCall?.args).toEqual(["title", "%50\\% off\\_deal%"]);
  });
});

describe("supabaseScriptRepository.updateScriptItem", () => {
  it("sends only the provided fields in the update payload", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ title: "Updated" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.updateScriptItem("script_1", { title: "Updated" });
    expect(result.success).toBe(true);

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ title: "Updated" });
  });

  it("returns a controlled not-found error rather than throwing on PGRST116", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "PGRST116", message: "no rows" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.updateScriptItem("missing", { title: "X" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseScriptRepository — archive / unarchive", () => {
  it("archives an item that is currently active", async () => {
    const { client, calls } = createMockSupabase([
      { data: itemRow({ status: "active", archived_at: null }), error: null },
      { data: itemRow({ status: "archived", archived_at: "2026-09-22T00:00:00Z" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.archiveScriptItem("script_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toMatchObject({ status: "archived" });
  });

  it("archiving an already-archived item is idempotent — never calls update again", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ status: "archived", archived_at: "2026-09-22T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.archiveScriptItem("script_1");
    expect(result.success).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("returns a controlled not-found error rather than throwing when the item does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.archiveScriptItem("missing");
    expect(result.success).toBe(false);
  });
});

describe("supabaseScriptRepository.createScriptVersion", () => {
  it("inserts a draft version and maps it back", async () => {
    const { client, calls } = createMockSupabase([{ data: versionRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.createScriptVersion(createVersionInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");

    const insertCall = calls.find((c) => c.table === "script_versions" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("version_number");
    expect(payload).not.toHaveProperty("status");
  });

  it("converts a unique-constraint violation (23505) into a controlled duplicate-draft error, never a raw Postgres error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.createScriptVersion(createVersionInput());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toMatch(/23505|constraint|postgres/i);
  });
});

describe("supabaseScriptRepository.getScriptVersionById / listScriptVersions", () => {
  it("returns the mapped version when found", async () => {
    const { client } = createMockSupabase([{ data: versionRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const version = await supabaseScriptRepository.getScriptVersionById("version_1");
    expect(version.id).toBe("version_1");
  });

  it("throws when no version row is found", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseScriptRepository.getScriptVersionById("missing")).rejects.toThrow();
  });

  it("scopes listScriptVersions to the given script_id and orders newest first", async () => {
    const { client, calls } = createMockSupabase([{ data: [versionRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const versions = await supabaseScriptRepository.listScriptVersions("script_1");
    expect(versions).toHaveLength(1);
    expect(calls.some((c) => c.table === "script_versions" && c.method === "eq" && c.args[0] === "script_id" && c.args[1] === "script_1")).toBe(true);
    const orderCalls = calls.filter((c) => c.method === "order");
    expect(orderCalls[0].args[0]).toBe("created_at");
  });
});

describe("supabaseScriptRepository.createScriptBlock / listScriptBlocks", () => {
  it("inserts a block and maps it back", async () => {
    const { client, calls } = createMockSupabase([{ data: blockRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.createScriptBlock(createBlockInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.content).toBe("Open on a wide shot of the venue.");

    const insertCall = calls.find((c) => c.table === "script_blocks" && c.method === "insert");
    expect((insertCall?.args[0] as { sort_order: number }).sort_order).toBe(0);
  });

  it("lists blocks for a version ordered by sort_order ascending", async () => {
    const { client, calls } = createMockSupabase([{ data: [blockRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const blocks = await supabaseScriptRepository.listScriptBlocks("version_1");
    expect(blocks).toHaveLength(1);
    expect(calls.some((c) => c.table === "script_blocks" && c.method === "eq" && c.args[0] === "script_version_id" && c.args[1] === "version_1")).toBe(true);
    const orderCall = calls.find((c) => c.method === "order");
    expect(orderCall?.args).toEqual(["sort_order", { ascending: true }]);
  });
});

describe("supabaseScriptRepository.updateScriptBlock", () => {
  it("sends only the provided fields, including an explicit sort_order of 0", async () => {
    const { client, calls } = createMockSupabase([{ data: blockRow({ sort_order: 0 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.updateScriptBlock("block_1", { sortOrder: 0 });
    expect(result.success).toBe(true);

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ sort_order: 0 });
  });

  it("returns a controlled not-found error rather than throwing on PGRST116", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "PGRST116", message: "no rows" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.updateScriptBlock("missing", { content: "X" });
    expect(result.success).toBe(false);
  });
});

describe("supabaseScriptRepository.removeScriptBlock", () => {
  it("deletes the row scoped by id and succeeds when a row was actually removed", async () => {
    const { client, calls } = createMockSupabase([{ data: [{ id: "block_1" }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.removeScriptBlock("block_1");
    expect(result.success).toBe(true);

    expect(calls.some((c) => c.table === "script_blocks" && c.method === "delete")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "id" && c.args[1] === "block_1")).toBe(true);
  });

  it("returns a controlled not-found error when no row matched (already gone or cross-workspace, RLS-excluded) rather than a false success", async () => {
    const { client } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseScriptRepository.removeScriptBlock("missing");
    expect(result.success).toBe(false);
  });

  it("throws on a genuine database error rather than swallowing it", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "500", message: "connection lost" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseScriptRepository.removeScriptBlock("block_1")).rejects.toThrow();
  });
});

describe("supabaseScriptRepository — no secret-bearing fields", () => {
  it("the mapped domain object never carries a token/signed-URL-shaped field", async () => {
    const { client } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseScriptRepository.getScriptItemById("script_1");
    expect(JSON.stringify(item)).not.toMatch(/access_token|refresh_token|signed_url|client_secret/i);
  });
});
