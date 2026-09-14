import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseCarouselRepository } from "@/lib/data/carousel/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateCarouselItemInput, CreateCarouselSlideInput } from "@/lib/data/carousel/repository";

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
    id: "carousel_1",
    workspace_id: "ws_1",
    title: "Autumn wedding carousel",
    status: "active",
    source_idea_id: null,
    archived_at: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

function slideRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "slide_1",
    carousel_id: "carousel_1",
    workspace_id: "ws_1",
    content: "Slide one text.",
    sort_order: 0,
    media_asset_id: null,
    created_at: "2026-09-24T00:00:00Z",
    updated_at: "2026-09-24T00:00:00Z",
    ...overrides,
  };
}

function createItemInput(overrides: Partial<CreateCarouselItemInput> = {}): CreateCarouselItemInput {
  return { workspaceId: "ws_1", createdBy: "11111111-1111-4111-8111-111111111111", title: "Autumn wedding carousel", sourceIdeaId: null, ...overrides };
}

function createSlideInput(overrides: Partial<CreateCarouselSlideInput> = {}): CreateCarouselSlideInput {
  return { carouselId: "carousel_1", workspaceId: "ws_1", content: "Slide one text.", sortOrder: 0, mediaAssetId: null, ...overrides };
}

describe("supabaseCarouselRepository — carousel_items", () => {
  it("createCarouselItem inserts the expected payload and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.createCarouselItem(createItemInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Autumn wedding carousel");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "ws_1", title: "Autumn wedding carousel", source_idea_id: null });
  });

  it("getCarouselItemById throws when the row does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    await expect(supabaseCarouselRepository.getCarouselItemById("missing")).rejects.toThrow();
  });

  it("listCarouselItems filters by workspace and active status by default", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.listCarouselItems("ws_1");
    expect(result).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
    expect(eqCalls).toContainEqual(["status", "active"]);
  });

  it("updateCarouselItem maps PGRST116 (no matching row) to a controlled not-found error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "PGRST116" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    const result = await supabaseCarouselRepository.updateCarouselItem("missing", { title: "x" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("This Carousel could not be found.");
  });

  it("archiveCarouselItem is idempotent — returns the existing row unchanged if already archived", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ status: "archived", archived_at: "2026-09-24T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.archiveCarouselItem("carousel_1");
    expect(result.success).toBe(true);
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("unarchiveCarouselItem clears archived_at", async () => {
    const { client } = createMockSupabase([
      { data: itemRow({ status: "archived", archived_at: "2026-09-24T00:00:00Z" }), error: null },
      { data: itemRow({ status: "active", archived_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.unarchiveCarouselItem("carousel_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
  });
});

describe("supabaseCarouselRepository — carousel_slides", () => {
  it("createCarouselSlide inserts the expected payload including media_asset_id", async () => {
    const { client, calls } = createMockSupabase([{ data: slideRow({ media_asset_id: "media_1" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.createCarouselSlide(createSlideInput({ mediaAssetId: "media_1" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.media_asset_id).toBe("media_1");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ carousel_id: "carousel_1", content: "Slide one text.", sort_order: 0, media_asset_id: "media_1" });
  });

  it("listCarouselSlides orders by sort_order ascending, then id", async () => {
    const { client, calls } = createMockSupabase([{ data: [slideRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseCarouselRepository.listCarouselSlides("carousel_1");
    const orderCalls = calls.filter((c) => c.method === "order").map((c) => c.args);
    expect(orderCalls[0]).toEqual(["sort_order", { ascending: true }]);
    expect(orderCalls[1]).toEqual(["id", { ascending: true }]);
  });

  it("updateCarouselSlide only patches fields explicitly provided", async () => {
    const { client, calls } = createMockSupabase([{ data: slideRow({ content: "Updated" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseCarouselRepository.updateCarouselSlide("slide_1", { content: "Updated" });
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ content: "Updated" });
  });

  it("removeCarouselSlide returns a controlled not-found error when zero rows matched", async () => {
    const { client } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.removeCarouselSlide("missing");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("This Carousel slide could not be found.");
  });

  it("removeCarouselSlide succeeds when a row was actually deleted", async () => {
    const { client } = createMockSupabase([{ data: [{ id: "slide_1" }], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseCarouselRepository.removeCarouselSlide("slide_1");
    expect(result.success).toBe(true);
  });
});
