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

import { supabasePurchasesRepository } from "@/lib/data/purchases/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import { getClientWorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { NotFoundError } from "@/core/errors";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import type { CreatePurchaseInput, PurchaseInput, PurchaseItemInput, ReceivePurchaseItemInput } from "@/modules/purchases/schema";

/**
 * getCoreTimelineService()/getCoreNotesService() branch on NEXT_PUBLIC_DATA_MODE,
 * which is unset (defaults to "mock") in this Vitest environment regardless
 * of .env.local — so every Timeline/Notes call this repository makes
 * actually resolves to the shared in-memory mock store, never touching the
 * fake Supabase client constructed below (only raw `.from("purchases")`/
 * `.from("purchase_items")`/`.rpc(...)` calls do). Tests that exercise
 * Timeline/Notes reads or writes verify against that real mock store
 * (mirroring mockRepository.test.ts's own "call a mutation, then read it
 * back" style) instead of queuing an inert fake row that would never be
 * consumed. Reset both stores after every test so one test's Timeline/Note
 * writes can't leak into the next.
 */

type QueryResult = { data: unknown; error: unknown; count?: number | null };
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
    b.lt = chain("lt");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
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
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
    workspace: {
      id: "workspace_1",
      name: "Amoré Bloom",
      slug: "amore-bloom",
      created_by: "user_1",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      archived_at: null,
    },
    membership: {
      id: "member_1",
      workspace_id: "workspace_1",
      user_id: "user_1",
      role: "owner" as const,
      status: "active" as const,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    },
  },
};

function mockSession() {
  vi.mocked(getClientWorkspaceSession).mockResolvedValue(SESSION as never);
}

afterEach(() => {
  vi.clearAllMocks();
  resetTimelineStore();
  resetNotesStore();
});

function purchaseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "purchase_1",
    workspace_id: "workspace_1",
    vendor_id: "vendor_1",
    purchase_number: "PO-2026-0001",
    status: "draft",
    order_date: null,
    expected_delivery_date: "2026-08-15",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 0,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 0,
    notes: null,
    vendor_reference: null,
    created_by: "Amoré Bloom Owner",
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

function purchaseItemRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "purchase_item_1",
    workspace_id: "workspace_1",
    purchase_id: "purchase_1",
    inventory_item_id: null,
    name: "Rush processing fee",
    sku: null,
    quantity_ordered: 1,
    quantity_received: 0,
    unit_cost_minor: 5000,
    line_subtotal_minor: 5000,
    display_order: 0,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const CREATE_INPUT: CreatePurchaseInput = {
  vendor_id: "vendor_1",
  expected_delivery_date: "2026-08-15",
  currency: "USD",
  tax_minor: 0,
  shipping_minor: 0,
  discount_minor: 0,
  notes: null,
  vendor_reference: null,
};

const UPDATE_INPUT: PurchaseInput = {
  expected_delivery_date: "2026-08-20",
  currency: "USD",
  tax_minor: 100,
  shipping_minor: 200,
  discount_minor: 0,
  notes: "Updated notes",
  vendor_reference: "VEND-REF-1",
};

const ITEM_INPUT: PurchaseItemInput = {
  inventory_item_id: null,
  name: "Rush processing fee",
  sku: null,
  quantity_ordered: 1,
  unit_cost_minor: 5000,
};

const RECEIVE_INPUT: ReceivePurchaseItemInput = {
  quantity_received: 1,
  reason: null,
};

describe("supabasePurchasesRepository.listPurchases", () => {
  it("scopes the query to the workspace and excludes archived purchases by default", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.listPurchases();

    expect(purchases).toHaveLength(1);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "workspace_1")).toBe(true);
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status" && c.args[1] === "archived")).toBe(true);
  });

  it("includes archived purchases when includeArchived is true", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseRow({ status: "archived", archived_at: "2026-08-01T00:00:00Z" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.listPurchases({ includeArchived: true });

    expect(purchases).toHaveLength(1);
    expect(calls.some((c) => c.method === "neq" && c.args[0] === "status")).toBe(false);
  });

  it("applies status and vendorId filters as eq clauses", async () => {
    const { client, calls } = createMockSupabase([{ data: [], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await supabasePurchasesRepository.listPurchases({ status: "submitted", vendorId: "vendor_1" });

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status" && c.args[1] === "submitted")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "vendor_id" && c.args[1] === "vendor_1")).toBe(true);
  });

  it("filters by search term across purchase_number/vendor_reference/notes in application code", async () => {
    const { client } = createMockSupabase([
      {
        data: [
          purchaseRow({ id: "purchase_1", purchase_number: "PO-2026-0001" }),
          purchaseRow({ id: "purchase_2", purchase_number: "PO-2026-0002", vendor_reference: "Linens special order" }),
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.listPurchases({ search: "linens" });

    expect(purchases).toHaveLength(1);
    expect(purchases[0].id).toBe("purchase_2");
  });
});

describe("supabasePurchasesRepository.getPurchase", () => {
  it("maps every field from the row", async () => {
    const { client } = createMockSupabase([{ data: purchaseRow({ status: "submitted", tax_minor: 500 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const purchase = await supabasePurchasesRepository.getPurchase("purchase_1");

    expect(purchase.id).toBe("purchase_1");
    expect(purchase.status).toBe("submitted");
    expect(purchase.tax_minor).toBe(500);
  });

  it("throws NotFoundError when the purchase does not exist (or belongs to another Workspace, per RLS)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabasePurchasesRepository.getPurchase("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("supabasePurchasesRepository.createPurchase", () => {
  it("validates the vendor exists in the workspace, generates a purchase_number, and records Timeline", async () => {
    const { client, calls } = createMockSupabase([
      { data: { id: "vendor_1" }, error: null }, // vendor check
      { data: null, error: null, count: 0 }, // number-generation count
      { data: purchaseRow(), error: null }, // insert
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.createPurchase(CREATE_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.vendor_id).toBe("vendor_1");
    expect(result.data.status).toBe("draft");
    const insertCall = calls.find((c) => c.table === "purchases" && c.method === "insert");
    expect(insertCall).toBeDefined();
    const insertedRow = insertCall?.args[0] as Record<string, unknown>;
    expect(insertedRow.workspace_id).toBe("workspace_1");
    expect(insertedRow.purchase_number).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(insertedRow.subtotal_minor).toBe(0);
  });

  it("fails validation before touching Supabase for a missing vendor_id", async () => {
    const { client, calls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.createPurchase({ ...CREATE_INPUT, vendor_id: "" });

    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("fails when the vendor doesn't exist in this workspace", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.createPurchase(CREATE_INPUT);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.vendor_id).toBeDefined();
  });

  it("rejects a negative total (discount larger than tax+shipping) before ever inserting", async () => {
    const { client, calls } = createMockSupabase([{ data: { id: "vendor_1" }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.createPurchase({ ...CREATE_INPUT, discount_minor: 100 });

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.table === "purchases" && c.method === "insert")).toBe(false);
  });

  it("retries with a freshly generated number when a concurrent writer wins the unique-index race", async () => {
    const { client, rpcCalls: _unused } = createMockSupabase([
      { data: { id: "vendor_1" }, error: null }, // vendor check
      { data: null, error: null, count: 0 }, // number-generation count, attempt 1
      { data: null, error: { code: "23505" } }, // insert fails, duplicate number
      { data: null, error: null, count: 1 }, // number-generation count, attempt 2
      { data: purchaseRow({ purchase_number: "PO-2026-0002" }), error: null }, // insert succeeds
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.createPurchase(CREATE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.purchase_number).toBe("PO-2026-0002");
    void _unused;
  });
});

describe("supabasePurchasesRepository.updatePurchase", () => {
  it("recomputes total_minor from the existing subtotal and records Timeline", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow({ subtotal_minor: 1000 }), error: null }, // fetch existing
      { data: purchaseRow({ subtotal_minor: 1000, tax_minor: 100, shipping_minor: 200, total_minor: 1300 }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.updatePurchase("purchase_1", UPDATE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.total_minor).toBe(1300);
  });

  it("fails when the purchase is archived", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ archived_at: "2026-08-01T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.updatePurchase("purchase_1", UPDATE_INPUT);

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("fails once the purchase has left draft/submitted (workflow validation, not a Supabase call)", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ status: "fully_received" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.updatePurchase("purchase_1", UPDATE_INPUT);

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("fails when the purchase does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.updatePurchase("missing", UPDATE_INPUT);

    expect(result.success).toBe(false);
  });
});

describe("supabasePurchasesRepository.submitPurchase / cancelPurchase", () => {
  it("submits a draft purchase with at least one item, stamping order_date", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow(), error: null }, // fetch existing
      { data: null, error: null, count: 1 }, // item count check
      { data: purchaseRow({ status: "submitted", order_date: "2026-08-01T00:00:00Z" }), error: null }, // update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.submitPurchase("purchase_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("submitted");
      expect(result.data.order_date).not.toBeNull();
    }
  });

  it("rejects submitting a purchase with no line items", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseRow(), error: null },
      { data: null, error: null, count: 0 },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.submitPurchase("purchase_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.table === "purchases" && c.method === "update")).toBe(false);
  });

  it("rejects submitting from an illegal status (already archived)", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ status: "archived" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.submitPurchase("purchase_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.table === "purchase_items")).toBe(false);
  });

  it("cancels a submitted purchase", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow({ status: "submitted" }), error: null },
      { data: purchaseRow({ status: "cancelled" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.cancelPurchase("purchase_1");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });

  it("rejects cancelling a purchase that is already fully_received", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ status: "fully_received" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.cancelPurchase("purchase_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("supabasePurchasesRepository.archivePurchase / restorePurchase", () => {
  it("archives a cancelled purchase", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow({ status: "cancelled" }), error: null },
      { data: purchaseRow({ status: "archived", archived_at: "2026-08-01T00:00:00Z" }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.archivePurchase("purchase_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("archived");
      expect(result.data.archived_at).not.toBeNull();
    }
  });

  it("fails to archive an already-archived purchase", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ archived_at: "2026-08-01T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.archivePurchase("purchase_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("always restores an archived purchase to draft, regardless of its status before archiving", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow({ status: "archived", archived_at: "2026-08-01T00:00:00Z" }), error: null },
      { data: purchaseRow({ status: "draft", archived_at: null }), error: null },
      { data: null, error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.restorePurchase("purchase_1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.archived_at).toBeNull();
    }
  });

  it("fails to restore a purchase that isn't archived", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.restorePurchase("purchase_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });
});

describe("supabasePurchasesRepository.listPurchaseItems", () => {
  it("orders by display_order ascending", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseItemRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const items = await supabasePurchasesRepository.listPurchaseItems("purchase_1");

    expect(items).toHaveLength(1);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "display_order")).toBe(true);
  });
});

describe("supabasePurchasesRepository.addPurchaseItem", () => {
  it("computes line_subtotal_minor, assigns the next display_order, and recomputes purchase totals", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseRow(), error: null }, // fetch purchase
      { data: null, error: null, count: 2 }, // existing item count -> display_order
      { data: purchaseItemRow({ display_order: 2 }), error: null }, // insert item
      { data: purchaseRow(), error: null }, // recompute: fetch purchase
      { data: [purchaseItemRow({ display_order: 2 })], error: null }, // recompute: fetch items
      { data: purchaseRow({ subtotal_minor: 5000, total_minor: 5000 }), error: null }, // recompute: update purchase
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.addPurchaseItem("purchase_1", ITEM_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.line_subtotal_minor).toBe(5000);
    const insertCall = calls.find((c) => c.table === "purchase_items" && c.method === "insert");
    expect((insertCall?.args[0] as Record<string, unknown>).display_order).toBe(2);
    expect((insertCall?.args[0] as Record<string, unknown>).quantity_received).toBe(0);
    const purchaseUpdateCall = calls.find((c) => c.table === "purchases" && c.method === "update");
    expect((purchaseUpdateCall?.args[0] as Record<string, unknown>).subtotal_minor).toBe(5000);
  });

  it("fails when the purchase is not draft", async () => {
    const { client, calls } = createMockSupabase([{ data: purchaseRow({ status: "submitted" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.addPurchaseItem("purchase_1", ITEM_INPUT);

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("validates a linked inventory_item_id exists in the workspace before inserting", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseRow(), error: null }, // fetch purchase
      { data: null, error: null }, // inventory item lookup -> not found
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.addPurchaseItem("purchase_1", { ...ITEM_INPUT, inventory_item_id: "inv_missing" });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors?.inventory_item_id).toBeDefined();
    expect(calls.some((c) => c.table === "purchase_items")).toBe(false);
  });
});

describe("supabasePurchasesRepository.updatePurchaseItem", () => {
  it("recomputes line_subtotal_minor and cascades a purchase totals recompute", async () => {
    const { client } = createMockSupabase([
      { data: purchaseItemRow(), error: null }, // fetch existing item
      { data: purchaseRow(), error: null }, // fetch parent purchase
      { data: purchaseItemRow({ quantity_ordered: 2, unit_cost_minor: 5000, line_subtotal_minor: 10000 }), error: null }, // update
      { data: purchaseRow(), error: null }, // recompute: fetch purchase
      { data: [purchaseItemRow({ quantity_ordered: 2, line_subtotal_minor: 10000 })], error: null }, // recompute: fetch items
      { data: purchaseRow({ subtotal_minor: 10000, total_minor: 10000 }), error: null }, // recompute: update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.updatePurchaseItem("purchase_item_1", { ...ITEM_INPUT, quantity_ordered: 2 });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.line_subtotal_minor).toBe(10000);
  });

  it("fails once the parent purchase has left draft", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseItemRow(), error: null },
      { data: purchaseRow({ status: "submitted" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.updatePurchaseItem("purchase_item_1", ITEM_INPUT);

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "update")).toBe(false);
  });

  it("fails when the item does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.updatePurchaseItem("missing", ITEM_INPUT);

    expect(result.success).toBe(false);
  });
});

describe("supabasePurchasesRepository.removePurchaseItem", () => {
  it("hard-deletes a draft, unreceived item and recomputes purchase totals", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseItemRow(), error: null }, // fetch existing item
      { data: purchaseRow(), error: null }, // fetch parent purchase
      { data: null, error: null }, // delete
      { data: purchaseRow(), error: null }, // recompute: fetch purchase
      { data: [], error: null }, // recompute: fetch items
      { data: purchaseRow({ subtotal_minor: 0, total_minor: 0 }), error: null }, // recompute: update
      { data: null, error: null }, // timeline insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.removePurchaseItem("purchase_item_1");

    expect(result.success).toBe(true);
    expect(calls.some((c) => c.table === "purchase_items" && c.method === "delete")).toBe(true);
  });

  it("rejects removing an item that already has quantity_received", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseItemRow({ quantity_received: 1 }), error: null },
      { data: purchaseRow(), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.removePurchaseItem("purchase_item_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("rejects removing an item once the purchase has left draft", async () => {
    const { client, calls } = createMockSupabase([
      { data: purchaseItemRow(), error: null },
      { data: purchaseRow({ status: "submitted" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.removePurchaseItem("purchase_item_1");

    expect(result.success).toBe(false);
    expect(calls.some((c) => c.method === "delete")).toBe(false);
  });
});

describe("supabasePurchasesRepository.receivePurchaseItem", () => {
  it("calls record_purchase_receipt exactly once and maps the returned row — no more direct purchase_items/purchases/timeline_activities calls", async () => {
    const { client, calls, rpcCalls } = createMockSupabase([
      { data: purchaseItemRow({ inventory_item_id: "inv_1", quantity_ordered: 5, quantity_received: 1 }), error: null }, // rpc
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity_received).toBe(1);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("record_purchase_receipt");
    expect((rpcCalls[0].args as Record<string, unknown>).p_purchase_item_id).toBe("purchase_item_1");
    expect((rpcCalls[0].args as Record<string, unknown>).p_quantity_received).toBe(1);
    expect(calls.some((c) => c.table === "purchase_items" || c.table === "purchases" || c.table === "timeline_activities")).toBe(false);
  });

  it("supplies a fresh p_receipt_event_id on every call, since the RPC no longer defaults it server-side", async () => {
    const { client, rpcCalls } = createMockSupabase([
      { data: purchaseItemRow({ quantity_received: 1 }), error: null },
      { data: purchaseItemRow({ quantity_received: 2 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);
    await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    const firstId = (rpcCalls[0].args as Record<string, unknown>).p_receipt_event_id;
    const secondId = (rpcCalls[1].args as Record<string, unknown>).p_receipt_event_id;
    expect(typeof firstId).toBe("string");
    expect((firstId as string).length).toBeGreaterThan(0);
    expect(firstId).not.toBe(secondId);
  });

  it("passes the caller's reason through, or null when omitted", async () => {
    const { client, rpcCalls } = createMockSupabase([{ data: purchaseItemRow({ quantity_received: 1 }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", { quantity_received: 1, reason: "Partial shipment" });

    expect((rpcCalls[0].args as Record<string, unknown>).p_reason).toBe("Partial shipment");
  });

  it("rejects validation before ever calling the RPC for a non-positive quantity_received", async () => {
    const { client, rpcCalls } = createMockSupabase([]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", { quantity_received: 0, reason: null });

    expect(result.success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("converts a P0006 (not found) RPC failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "P0006", message: "Purchase item not found." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("missing", RECEIVE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("not found");
  });

  it("converts a P0007 (archived purchase) RPC failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "P0007", message: "Archived purchases cannot receive stock." } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Archived");
  });

  it("converts a P0008 (draft/cancelled/fully_received purchase) RPC failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([
      { data: null, error: { code: "P0008", message: "This purchase cannot receive stock in its current status." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    expect(result.success).toBe(false);
  });

  it("converts a P0009 (over-receipt) RPC failure into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([
      { data: null, error: { code: "P0009", message: "Quantity received cannot exceed quantity ordered." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    expect(result.success).toBe(false);
  });

  it("converts a P0003 (archived Inventory item) RPC failure — forwarded unchanged from the composed record_inventory_movement — into a DataResult failure without throwing", async () => {
    const { client } = createMockSupabase([
      { data: null, error: { code: "P0003", message: "Archived inventory items cannot receive stock movements. Restore it first." } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const result = await supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Archived");
  });

  it("throws (does not silently succeed) for an unrecognized RPC error code", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23503", message: "foreign key violation" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    await expect(supabasePurchasesRepository.receivePurchaseItem("purchase_item_1", RECEIVE_INPUT)).rejects.toThrow();
  });
});

describe("supabasePurchasesRepository.getPurchaseReceiptSummary", () => {
  it("sums ordered/received across items and derives the receipt state", async () => {
    const { client } = createMockSupabase([
      { data: purchaseRow(), error: null },
      {
        data: [
          purchaseItemRow({ id: "a", quantity_ordered: 10, quantity_received: 10 }),
          purchaseItemRow({ id: "b", quantity_ordered: 5, quantity_received: 2 }),
        ],
        error: null,
      },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const summary = await supabasePurchasesRepository.getPurchaseReceiptSummary("purchase_1");

    expect(summary.totalOrdered).toBe(15);
    expect(summary.totalReceived).toBe(12);
    expect(summary.isPartiallyReceived).toBe(true);
    expect(summary.isFullyReceived).toBe(false);
  });

  it("throws NotFoundError for a missing purchase", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabasePurchasesRepository.getPurchaseReceiptSummary("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("supabasePurchasesRepository.getPurchasesByVendorId / getOpenPurchases / getOverduePurchases", () => {
  it("getPurchasesByVendorId scopes to workspace and vendor_id", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.getPurchasesByVendorId("vendor_1");

    expect(purchases).toHaveLength(1);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "vendor_id" && c.args[1] === "vendor_1")).toBe(true);
  });

  it("getOpenPurchases filters to submitted/partially_received", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseRow({ status: "submitted" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.getOpenPurchases();

    expect(purchases).toHaveLength(1);
    expect(calls.some((c) => c.method === "in" && c.args[0] === "status" && (c.args[1] as string[]).includes("submitted"))).toBe(true);
  });

  it("getOverduePurchases additionally requires a past, non-null expected_delivery_date", async () => {
    const { client, calls } = createMockSupabase([{ data: [purchaseRow({ status: "submitted", expected_delivery_date: "2020-01-01" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    mockSession();

    const purchases = await supabasePurchasesRepository.getOverduePurchases();

    expect(purchases).toHaveLength(1);
    expect(calls.some((c) => c.method === "not" && c.args[0] === "expected_delivery_date")).toBe(true);
    expect(calls.some((c) => c.method === "lt" && c.args[0] === "expected_delivery_date")).toBe(true);
  });
});

describe("supabasePurchasesRepository.getTimelineByPurchaseId", () => {
  it("returns Timeline entries recorded for this purchase, scoped by owner id", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: purchaseRow(), error: null }, // fetchPurchaseRow inside createPurchaseNote
      { data: purchaseRow(), error: null }, // fetchPurchaseRow inside getTimelineByPurchaseId
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabasePurchasesRepository.createPurchaseNote("purchase_1", NOTE_INPUT);
    const timeline = await supabasePurchasesRepository.getTimelineByPurchaseId("purchase_1");

    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.every((activity) => activity.owner_id === "purchase_1")).toBe(true);
  });

  it("returns an empty array for a purchase that does not exist (RLS-invisible or missing)", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const timeline = await supabasePurchasesRepository.getTimelineByPurchaseId("missing");

    expect(timeline).toEqual([]);
  });
});

const NOTE_INPUT = {
  title: "Vendor called",
  content: "Confirmed delivery window.",
  category: "general" as const,
  priority: "normal" as const,
};

describe("supabasePurchasesRepository.getNotesByPurchaseId", () => {
  it("returns a note created via createPurchaseNote, scoped to this purchase", async () => {
    mockSession();
    const { client } = createMockSupabase([
      { data: purchaseRow(), error: null }, // fetchPurchaseRow inside createPurchaseNote
      { data: purchaseRow(), error: null }, // fetchPurchaseRow inside getNotesByPurchaseId
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabasePurchasesRepository.createPurchaseNote("purchase_1", NOTE_INPUT);
    const notes = await supabasePurchasesRepository.getNotesByPurchaseId("purchase_1");

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe(NOTE_INPUT.title);
    expect(notes[0].owner_id).toBe("purchase_1");
  });

  it("returns an empty array for a purchase that does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const notes = await supabasePurchasesRepository.getNotesByPurchaseId("missing");

    expect(notes).toEqual([]);
  });
});

describe("supabasePurchasesRepository.createPurchaseNote / updatePurchaseNote / togglePurchaseNotePin", () => {
  it("creates the note through the shared Core Notes helper, scoped to the purchase's workspace", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: purchaseRow(), error: null }]); // fetchPurchaseRow
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.createPurchaseNote("purchase_1", NOTE_INPUT);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_type).toBe("purchase");
    expect(result.data.owner_id).toBe("purchase_1");
    expect(result.data.title).toBe(NOTE_INPUT.title);
  });

  it("fails to create a note for a purchase that does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabasePurchasesRepository.createPurchaseNote("missing", NOTE_INPUT);

    expect(result.success).toBe(false);
  });

  it("updates a note by id, scoped to the current workspace", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: purchaseRow(), error: null }]); // fetchPurchaseRow for the initial create
    vi.mocked(createClient).mockReturnValue(client as never);

    const created = await supabasePurchasesRepository.createPurchaseNote("purchase_1", NOTE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await supabasePurchasesRepository.updatePurchaseNote(created.data.id, { ...NOTE_INPUT, title: "Updated" });

    expect(result).not.toBeNull();
    if (result?.success) expect(result.data.title).toBe("Updated");
  });

  it("toggles a note's pinned state", async () => {
    mockSession();
    const { client } = createMockSupabase([{ data: purchaseRow(), error: null }]); // fetchPurchaseRow for the initial create
    vi.mocked(createClient).mockReturnValue(client as never);

    const created = await supabasePurchasesRepository.createPurchaseNote("purchase_1", NOTE_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.is_pinned).toBe(false);

    const result = await supabasePurchasesRepository.togglePurchaseNotePin(created.data.id);

    expect(result).not.toBeNull();
    if (result?.success) expect(result.data.is_pinned).toBe(true);
  });
});
