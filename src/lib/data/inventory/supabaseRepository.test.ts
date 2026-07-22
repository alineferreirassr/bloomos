import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/auth/workspaceSessionClient", () => ({
  getClientWorkspaceSession: vi.fn(),
}));
vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: () => ({
    recordAuditEvent: vi.fn(),
    getAuditLogForOwner: vi.fn(),
  }),
}));

import { supabaseInventoryRepository } from "@/lib/data/inventory/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { NotFoundError } from "@/core/errors";
import type { CreateInventoryItemInput, InventoryItemInput } from "@/modules/inventory/schema";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  const rpcCalls: { name: string; args: unknown }[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) {
      throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    }
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
    b.neq = chain("neq");
    b.in = chain("in");
    b.is = chain("is");
    b.not = chain("not");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
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
  const client = {
    from: (table: string) => builder(table),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      return nextResult();
    },
  };
  return { client, calls, rpcCalls };
}

const SESSION = {
  status: "ok" as const,
  session: {
    user: { id: "user_1", email: "owner@example.com" },
    profile: {
      id: "user_1",
      full_name: "Amoré Bloom Owner",
      email: "owner@example.com",
      avatar_url: null,
      created_at: "2026-07-31T00:00:00Z",
      updated_at: "2026-07-31T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-07-31T00:00:00Z",
      updated_at: "2026-07-31T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-07-31T00:00:00Z",
      updated_at: "2026-07-31T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

function itemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item_1",
    workspace_id: "workspace_1",
    name: "White Pillar Candles",
    description: null,
    sku: "CAN-PIL-WHT",
    category: "Candles",
    subcategory: null,
    item_type: "consumable",
    tags: ["ceremony"],
    status: "active",
    condition: null,
    unit_of_measure: "each",
    quantity_on_hand: 50,
    quantity_available: 50,
    quantity_reserved: 0,
    reorder_level: 20,
    target_stock_level: 100,
    unit_cost: 200,
    replacement_cost: 200,
    rental_value: null,
    storage_location: "Studio",
    bin_location: null,
    primary_vendor_id: null,
    purchase_date: null,
    last_inventory_check_at: null,
    notes: null,
    image_url: null,
    created_at: "2026-07-31T00:00:00Z",
    updated_at: "2026-07-31T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function movementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "movement_1",
    workspace_id: "workspace_1",
    inventory_item_id: "item_1",
    movement_type: "purchase",
    quantity: 25,
    quantity_before: 50,
    quantity_after: 75,
    reason: "Restock",
    reference_type: null,
    reference_id: null,
    performed_by: "Amoré Bloom Owner",
    occurred_at: "2026-07-31T00:00:00Z",
    created_at: "2026-07-31T00:00:00Z",
    ...overrides,
  };
}

const CREATE_INPUT: CreateInventoryItemInput = {
  name: "White Pillar Candles",
  description: null,
  sku: "CAN-PIL-WHT",
  category: "Candles",
  subcategory: null,
  item_type: "consumable",
  status: "active",
  tags: ["ceremony"],
  condition: null,
  unit_of_measure: "each",
  reorder_level: 20,
  target_stock_level: 100,
  unit_cost: 200,
  replacement_cost: 200,
  rental_value: null,
  storage_location: "Studio",
  bin_location: null,
  primary_vendor_id: null,
  purchase_date: null,
  notes: null,
  image_url: null,
  initial_quantity: 0,
};

describe("supabaseInventoryRepository.listInventoryItems", () => {
  it("scopes the query to the workspace and excludes archived items by default", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const items = await supabaseInventoryRepository.listInventoryItems();

    expect(items).toHaveLength(1);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status" && c.args[1] === "archived")).toBe(true);
  });

  it("includes archived items when includeArchived is true", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow({ status: "archived", archived_at: "2026-07-31T00:00:00Z" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const items = await supabaseInventoryRepository.listInventoryItems({ includeArchived: true });

    expect(items).toHaveLength(1);
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status")).toBe(false);
  });

  it("applies status/category/itemType/condition filters as eq clauses", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await supabaseInventoryRepository.listInventoryItems({ status: "active", category: "Candles", itemType: "consumable", condition: "new" });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "active")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "category" && c.args[1] === "Candles")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "item_type" && c.args[1] === "consumable")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "condition" && c.args[1] === "new")).toBe(true);
  });

  it("filters by search term across name/sku/category/tags in application code", async () => {
    const { client } = createMockSupabase([
      {
        data: [itemRow({ id: "item_1", name: "White Pillar Candles" }), itemRow({ id: "item_2", name: "Gold Chiavari Chairs", sku: "CHAIR-GLD", category: "Furniture", tags: [] })],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const items = await supabaseInventoryRepository.listInventoryItems({ search: "chair" });

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("item_2");
  });
});

describe("supabaseInventoryRepository.getInventoryItem", () => {
  it("maps every field from the row", async () => {
    const { client } = createMockSupabase([{ data: itemRow({ condition: "good", item_type: "reusable" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const item = await supabaseInventoryRepository.getInventoryItem("item_1");

    expect(item.id).toBe("item_1");
    expect(item.name).toBe("White Pillar Candles");
    expect(item.condition).toBe("good");
    expect(item.item_type).toBe("reusable");
    expect(item.quantity_on_hand).toBe(50);
  });

  it("throws NotFoundError when the item does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseInventoryRepository.getInventoryItem("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("supabaseInventoryRepository.createInventoryItem", () => {
  it("inserts the item with zero starting quantities and records Timeline", async () => {
    const { client, calls } = createMockSupabase([
      { data: itemRow({ quantity_on_hand: 0, quantity_available: 0, quantity_reserved: 0 }), error: null },
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.createInventoryItem(CREATE_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.quantity_on_hand).toBe(0);
    const insertCall = calls.find((c) => c.table === "inventory_items" && c.method === "insert");
    expect(insertCall).toBeDefined();
    expect((insertCall?.args[0] as Record<string, unknown>).workspace_id).toBe("workspace_1");
  });

  it("calls record_inventory_movement for a positive initial_quantity and re-fetches the item", async () => {
    const { client, rpcCalls } = createMockSupabase([
      { data: itemRow({ quantity_on_hand: 0, quantity_available: 0 }), error: null }, // insert item
      { data: null, error: null }, // timeline insert (item created)
      { data: movementRow({ movement_type: "initial_stock", quantity: 50, quantity_before: 0, quantity_after: 50 }), error: null }, // rpc
      { data: itemRow({ quantity_on_hand: 50, quantity_available: 50 }), error: null }, // re-fetch item
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.createInventoryItem({ ...CREATE_INPUT, initial_quantity: 50 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.quantity_on_hand).toBe(50);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("record_inventory_movement");
    expect((rpcCalls[0].args as Record<string, unknown>).p_movement_type).toBe("initial_stock");
    expect((rpcCalls[0].args as Record<string, unknown>).p_quantity).toBe(50);
  });

  it("fails validation before touching Supabase for a blank name", async () => {
    const { client, calls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.createInventoryItem({ ...CREATE_INPUT, name: "" });

    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("fails validation for a consumable item with a non-null condition", async () => {
    const { client, calls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.createInventoryItem({ ...CREATE_INPUT, condition: "new" });

    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("surfaces a duplicate-SKU conflict as a field error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505", message: "duplicate key" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.createInventoryItem(CREATE_INPUT);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.sku).toBeDefined();
  });
});

describe("supabaseInventoryRepository.updateInventoryItem", () => {
  const UPDATE_INPUT: InventoryItemInput = {
    name: "Updated name",
    description: null,
    sku: "CAN-PIL-WHT",
    category: "Candles",
    subcategory: null,
    item_type: "consumable",
    status: "active",
    tags: ["ceremony"],
    condition: null,
    unit_of_measure: "each",
    reorder_level: 20,
    target_stock_level: 100,
    unit_cost: 200,
    replacement_cost: 200,
    rental_value: null,
    storage_location: "Studio",
    bin_location: null,
    primary_vendor_id: null,
    purchase_date: null,
    notes: null,
    image_url: null,
  };

  it("updates the item and records Timeline", async () => {
    const { client } = createMockSupabase([
      { data: itemRow(), error: null }, // fetch existing
      { data: itemRow({ name: "Updated name" }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.updateInventoryItem("item_1", UPDATE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Updated name");
  });

  it("fails when the item is archived", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ status: "archived", archived_at: "2026-07-31T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.updateInventoryItem("item_1", UPDATE_INPUT);

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("fails when the item does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.updateInventoryItem("missing", UPDATE_INPUT);

    expect(result.success).toBe(false);
  });

  it("allows a status transition between active and inactive", async () => {
    const { client } = createMockSupabase([
      { data: itemRow(), error: null },
      { data: itemRow({ status: "inactive" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.updateInventoryItem("item_1", { ...UPDATE_INPUT, status: "inactive" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("inactive");
  });
});

describe("supabaseInventoryRepository.archiveInventoryItem / restoreInventoryItem", () => {
  it("archives an active item", async () => {
    const { client } = createMockSupabase([
      { data: itemRow(), error: null },
      { data: itemRow({ status: "archived", archived_at: "2026-07-31T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.archiveInventoryItem("item_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("archived");
      expect(result.data.archived_at).not.toBeNull();
    }
  });

  it("fails to archive an already-archived item", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow({ status: "archived", archived_at: "2026-07-31T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.archiveInventoryItem("item_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("restores an archived item", async () => {
    const { client } = createMockSupabase([
      { data: itemRow({ status: "archived", archived_at: "2026-07-31T00:00:00Z" }), error: null },
      { data: itemRow({ status: "active", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.restoreInventoryItem("item_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.archived_at).toBeNull();
    }
  });

  it("fails to restore an item that isn't archived", async () => {
    const { client, calls } = createMockSupabase([{ data: itemRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.restoreInventoryItem("item_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("supabaseInventoryRepository.recordInventoryMovement", () => {
  it("calls the record_inventory_movement RPC with the resolved actor and maps the returned row", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: movementRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.recordInventoryMovement("item_1", {
      movement_type: "purchase",
      quantity: 25,
      reason: "Restock",
      reference_type: null,
      reference_id: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.movement_type).toBe("purchase");
      expect(result.data.quantity_after).toBe(75);
    }
    expect(rpcCalls[0].args).toMatchObject({
      p_inventory_item_id: "item_1",
      p_movement_type: "purchase",
      p_quantity: 25,
      p_actor: "Amoré Bloom Owner",
    });
  });

  it("fails validation before calling the RPC for a zero quantity", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInventoryRepository.recordInventoryMovement("item_1", {
      movement_type: "purchase",
      quantity: 0,
      reason: null,
      reference_type: null,
      reference_id: null,
    });

    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("converts a P0003 (archived item) transaction failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([
      { data: null, error: { code: "P0003", message: "Archived inventory items cannot receive stock movements. Restore it first." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.recordInventoryMovement("item_1", {
      movement_type: "purchase",
      quantity: 5,
      reason: null,
      reference_type: null,
      reference_id: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Archived");
  });

  it("converts a P0004 (invariant violation) transaction failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([
      { data: null, error: { code: "P0004", message: "Quantities cannot be negative." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabaseInventoryRepository.recordInventoryMovement("item_1", {
      movement_type: "adjustment_decrease",
      quantity: 999,
      reason: null,
      reference_type: null,
      reference_id: null,
    });

    expect(result.success).toBe(false);
  });

  it("throws (does not silently succeed) for an unrecognized error code from the RPC", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23503", message: "foreign key violation" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await expect(
      supabaseInventoryRepository.recordInventoryMovement("item_1", {
        movement_type: "purchase",
        quantity: 5,
        reason: null,
        reference_type: null,
        reference_id: null,
      }),
    ).rejects.toThrow();
  });
});

describe("supabaseInventoryRepository.listInventoryMovements", () => {
  it("scopes to workspace and item, ordered by occurred_at desc", async () => {
    const { client, calls } = createMockSupabase([{ data: [movementRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const movements = await supabaseInventoryRepository.listInventoryMovements("item_1");

    expect(movements).toHaveLength(1);
    const movementCalls = calls.filter((c) => c.table === "inventory_movements");
    expect(movementCalls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
    expect(movementCalls.some((c) => c.method === "eq" && c.args[0] === "inventory_item_id" && c.args[1] === "item_1")).toBe(true);
    expect(movementCalls.some((c) => c.method === "order" && c.args[0] === "occurred_at")).toBe(true);
  });
});

describe("supabaseInventoryRepository.getInventoryAvailability", () => {
  it("reports is_low_stock true when available has fallen to or below reorder_level", async () => {
    const { client } = createMockSupabase([{ data: itemRow({ quantity_available: 15, reorder_level: 20 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const availability = await supabaseInventoryRepository.getInventoryAvailability("item_1");

    expect(availability.is_low_stock).toBe(true);
  });

  it("reports is_low_stock false when there is no reorder_level set", async () => {
    const { client } = createMockSupabase([{ data: itemRow({ reorder_level: null }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const availability = await supabaseInventoryRepository.getInventoryAvailability("item_1");

    expect(availability.is_low_stock).toBe(false);
  });
});

describe("supabaseInventoryRepository.getLowStockItems", () => {
  it("narrows to non-archived items with a reorder_level set at the DB layer, then filters available <= reorder_level in application code", async () => {
    const { client, calls } = createMockSupabase([
      {
        data: [
          itemRow({ id: "item_low", quantity_available: 10, reorder_level: 20 }),
          itemRow({ id: "item_ok", quantity_available: 90, reorder_level: 20 }),
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const items = await supabaseInventoryRepository.getLowStockItems();

    expect(items.map((i) => i.id)).toEqual(["item_low"]);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "archived_at" && c.args[1] === null)).toBe(true);
    expect(calls.some((c) => c.method === "not" && c.args[0] === "reorder_level")).toBe(true);
  });
});

describe("supabaseInventoryRepository.getDamagedOrUnderRepairItems", () => {
  it("filters to condition damaged or under_repair, workspace-scoped", async () => {
    const { client, calls } = createMockSupabase([{ data: [itemRow({ condition: "damaged", item_type: "reusable" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const items = await supabaseInventoryRepository.getDamagedOrUnderRepairItems();

    expect(items).toHaveLength(1);
    expect(calls.some((c) => c.method === "in" && c.args[0] === "condition")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
  });
});
