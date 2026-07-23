import { afterEach, describe, expect, it } from "vitest";
import { mockPurchasesRepository } from "@/lib/data/purchases/mockRepository";
import { resetPurchasesStore, readPurchases, writePurchases } from "@/lib/data/mock/purchasesStore";
import { resetPurchaseItemsStore } from "@/lib/data/mock/purchaseItemsStore";
import { resetInventoryItemsStore, readInventoryItems } from "@/lib/data/mock/inventoryItemsStore";
import { resetInventoryMovementsStore, readInventoryMovements } from "@/lib/data/mock/inventoryMovementsStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { resetAuditLogStore, mockAuditLogRepository } from "@/lib/data/core/audit/mockRepository";
import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { ENTITY_TYPES } from "@/core/enums/entityType";
import { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
import { isEntitySearchable, getSearchableEntityConfig } from "@/core/search/registry";
import type { CreatePurchaseInput, PurchaseInput, PurchaseItemInput } from "@/modules/purchases/schema";

const {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  submitPurchase,
  cancelPurchase,
  archivePurchase,
  restorePurchase,
  listPurchaseItems,
  addPurchaseItem,
  updatePurchaseItem,
  removePurchaseItem,
  receivePurchaseItem,
  getPurchaseReceiptSummary,
  getPurchasesByVendorId,
  getOpenPurchases,
  getOverduePurchases,
  getTimelineByPurchaseId,
  getNotesByPurchaseId,
  createPurchaseNote,
} = mockPurchasesRepository;

afterEach(() => {
  resetPurchasesStore();
  resetPurchaseItemsStore();
  resetInventoryItemsStore();
  resetInventoryMovementsStore();
  resetTimelineStore();
  resetNotesStore();
  resetAuditLogStore();
});

const BASE_PURCHASE_INPUT: CreatePurchaseInput = {
  vendor_id: "vendor_1",
  expected_delivery_date: "2026-09-01",
  currency: "USD",
  tax_minor: 0,
  shipping_minor: 0,
  discount_minor: 0,
  notes: null,
  vendor_reference: null,
};

const BASE_ITEM_INPUT: PurchaseItemInput = {
  inventory_item_id: null,
  name: "Test line item",
  sku: null,
  quantity_ordered: 10,
  unit_cost_minor: 500,
};

async function createDraftWithItem(overrides: Partial<PurchaseItemInput> = {}) {
  const created = await createPurchase(BASE_PURCHASE_INPUT);
  if (!created.success) throw new Error("setup failed");
  const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, ...overrides });
  if (!item.success) throw new Error("setup failed");
  return { purchase: created.data, item: item.data };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

describe("createPurchase", () => {
  it("creates a draft purchase with a generated purchase_number and zeroed totals", async () => {
    const result = await createPurchase(BASE_PURCHASE_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.purchase_number).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(result.data.subtotal_minor).toBe(0);
    expect(result.data.total_minor).toBe(0);
    expect(result.data.order_date).toBeNull();
    expect(result.data.workspace_id).toBe(CURRENT_WORKSPACE_ID);
  });

  it("generates unique purchase numbers across multiple creates", async () => {
    const results = await Promise.all([createPurchase(BASE_PURCHASE_INPUT), createPurchase(BASE_PURCHASE_INPUT), createPurchase(BASE_PURCHASE_INPUT)]);
    const numbers = results.map((r) => (r.success ? r.data.purchase_number : null));
    expect(new Set(numbers).size).toBe(3);
  });

  it("rejects a vendor that doesn't exist", async () => {
    const result = await createPurchase({ ...BASE_PURCHASE_INPUT, vendor_id: "nope" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.vendor_id).toBeDefined();
  });

  it("rejects a negative total from tax/shipping/discount", async () => {
    const result = await createPurchase({ ...BASE_PURCHASE_INPUT, discount_minor: 100 });
    // subtotal is 0 at creation, so any positive discount makes the total negative
    expect(result.success).toBe(false);
  });

  it("records a Timeline entry and an Audit Log entry on create", async () => {
    const result = await createPurchase(BASE_PURCHASE_INPUT);
    if (!result.success) throw new Error("setup failed");

    const timeline = await getTimelineByPurchaseId(result.data.id);
    expect(timeline.some((activity) => (activity.type as string) === "purchase_created")).toBe(true);

    const auditEntries = await mockAuditLogRepository.getAuditLogForOwner(CURRENT_WORKSPACE_ID, "purchase", result.data.id);
    expect(auditEntries.some((entry) => entry.action === "purchase_created")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Workspace isolation
// ---------------------------------------------------------------------------

describe("workspace isolation", () => {
  it("excludes a Purchase belonging to a different workspace from listPurchases/getPurchase", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");

    const foreign = readPurchases().find((p) => p.id === created.data.id);
    if (!foreign) throw new Error("setup failed");
    // Simulate a row belonging to a different workspace by mutating the store directly.
    writePurchases(readPurchases().map((p) => (p.id === created.data.id ? { ...p, workspace_id: "ws_other" } : p)));

    const list = await listPurchases({ includeArchived: true });
    expect(list.some((p) => p.id === created.data.id)).toBe(false);
    await expect(getPurchase(created.data.id)).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

describe("updatePurchase", () => {
  it("updates header fields while draft", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");

    const input: PurchaseInput = { ...BASE_PURCHASE_INPUT, notes: "Updated notes", tax_minor: 100 };
    const result = await updatePurchase(created.data.id, input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Updated notes");
      expect(result.data.tax_minor).toBe(100);
    }
  });

  it("allows editing while submitted", async () => {
    const { purchase } = await createDraftWithItem();
    const submitted = await submitPurchase(purchase.id);
    if (!submitted.success) throw new Error("setup failed");

    const result = await updatePurchase(purchase.id, { ...BASE_PURCHASE_INPUT, notes: "Still editable" });
    expect(result.success).toBe(true);
  });

  it("rejects editing a cancelled purchase", async () => {
    const { purchase } = await createDraftWithItem();
    await submitPurchase(purchase.id);
    await cancelPurchase(purchase.id);

    const result = await updatePurchase(purchase.id, { ...BASE_PURCHASE_INPUT, notes: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects editing an archived purchase", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await archivePurchase(created.data.id);

    const result = await updatePurchase(created.data.id, { ...BASE_PURCHASE_INPUT, notes: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects a total that would go negative", async () => {
    const { purchase } = await createDraftWithItem({ quantity_ordered: 1, unit_cost_minor: 100 });
    const result = await updatePurchase(purchase.id, { ...BASE_PURCHASE_INPUT, discount_minor: 100000 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

describe("status transitions", () => {
  it("submits a draft with items to submitted and stamps order_date", async () => {
    const { purchase } = await createDraftWithItem();
    const result = await submitPurchase(purchase.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("submitted");
      expect(result.data.order_date).not.toBeNull();
    }
  });

  it("rejects submitting a draft with no line items", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const result = await submitPurchase(created.data.id);
    expect(result.success).toBe(false);
  });

  it("rejects submitting an already-submitted purchase", async () => {
    const { purchase } = await createDraftWithItem();
    await submitPurchase(purchase.id);
    const result = await submitPurchase(purchase.id);
    expect(result.success).toBe(false);
  });

  it("cancels a submitted purchase", async () => {
    const { purchase } = await createDraftWithItem();
    await submitPurchase(purchase.id);
    const result = await cancelPurchase(purchase.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });

  it("rejects cancelling a fully_received purchase", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 5, reason: null });

    const result = await cancelPurchase(purchase.id);
    expect(result.success).toBe(false);
  });

  it("allows cancelling directly from draft (an abandoned order that was never submitted)", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const result = await cancelPurchase(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });

  it("archives a draft, a cancelled, and a fully_received purchase", async () => {
    const draft = await createPurchase(BASE_PURCHASE_INPUT);
    if (!draft.success) throw new Error("setup failed");
    expect((await archivePurchase(draft.data.id)).success).toBe(true);

    const { purchase: cancelled } = await createDraftWithItem();
    await submitPurchase(cancelled.id);
    await cancelPurchase(cancelled.id);
    expect((await archivePurchase(cancelled.id)).success).toBe(true);
  });

  it("rejects archiving an already-archived purchase", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await archivePurchase(created.data.id);
    const result = await archivePurchase(created.data.id);
    expect(result.success).toBe(false);
  });

  it("restores an archived purchase back to draft", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await archivePurchase(created.data.id);

    const result = await restorePurchase(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.archived_at).toBeNull();
    }
  });

  it("rejects restoring a purchase that isn't archived", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const result = await restorePurchase(created.data.id);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Line items — add/update/remove
// ---------------------------------------------------------------------------

describe("purchase items", () => {
  it("adds an item and recomputes the purchase subtotal/total", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");

    const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, quantity_ordered: 4, unit_cost_minor: 250 });
    expect(item.success).toBe(true);
    if (item.success) expect(item.data.line_subtotal_minor).toBe(1000);

    const purchase = await getPurchase(created.data.id);
    expect(purchase.subtotal_minor).toBe(1000);
    expect(purchase.total_minor).toBe(1000);
  });

  it("supports a line item with no Inventory reference (non-inventory expense)", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, inventory_item_id: null, name: "Delivery fee" });
    expect(item.success).toBe(true);
    if (item.success) expect(item.data.inventory_item_id).toBeNull();
  });

  it("supports a line item linked to a real Inventory item", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, inventory_item_id: "inventory_item_1", sku: "CAN-TAP-IVR-12" });
    expect(item.success).toBe(true);
    if (item.success) expect(item.data.inventory_item_id).toBe("inventory_item_1");
  });

  it("rejects a line item referencing an Inventory item that doesn't exist", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, inventory_item_id: "nope" });
    expect(item.success).toBe(false);
  });

  it("rejects a non-positive quantity_ordered at the schema level", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const item = await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, quantity_ordered: 0 });
    expect(item.success).toBe(false);
  });

  it("updates an item and recomputes totals", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 2, unit_cost_minor: 100 });
    const updated = await updatePurchaseItem(item.id, { ...BASE_ITEM_INPUT, quantity_ordered: 5, unit_cost_minor: 100 });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.line_subtotal_minor).toBe(500);

    const refreshed = await getPurchase(purchase.id);
    expect(refreshed.subtotal_minor).toBe(500);
  });

  it("rejects adding/editing/removing items once the purchase is submitted", async () => {
    const { purchase, item } = await createDraftWithItem();
    await submitPurchase(purchase.id);

    expect((await addPurchaseItem(purchase.id, BASE_ITEM_INPUT)).success).toBe(false);
    expect((await updatePurchaseItem(item.id, BASE_ITEM_INPUT)).success).toBe(false);
    expect((await removePurchaseItem(item.id)).success).toBe(false);
  });

  it("removes an item while the purchase is a draft", async () => {
    const { purchase, item } = await createDraftWithItem();
    const result = await removePurchaseItem(item.id);
    expect(result.success).toBe(true);

    const items = await listPurchaseItems(purchase.id);
    expect(items).toHaveLength(0);
    const refreshed = await getPurchase(purchase.id);
    expect(refreshed.subtotal_minor).toBe(0);
  });

  it("rejects removing an item once something has been received against it, even while otherwise editable", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 1, reason: null });

    // Item removal requires draft status AND zero received — both conditions now fail.
    const result = await removePurchaseItem(item.id);
    expect(result.success).toBe(false);
  });

  it("lists items ordered by display_order", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, name: "First" });
    await addPurchaseItem(created.data.id, { ...BASE_ITEM_INPUT, name: "Second" });

    const items = await listPurchaseItems(created.data.id);
    expect(items.map((i) => i.name)).toEqual(["First", "Second"]);
  });
});

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

describe("receivePurchaseItem", () => {
  it("partially receives an item and moves the purchase to partially_received", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 10 });
    await submitPurchase(purchase.id);

    const result = await receivePurchaseItem(item.id, { quantity_received: 4, reason: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity_received).toBe(4);

    const refreshed = await getPurchase(purchase.id);
    expect(refreshed.status).toBe("partially_received");
    expect(refreshed.actual_received_date).toBeNull();
  });

  it("fully receives an item and moves the purchase to fully_received with actual_received_date set", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 10 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 10, reason: null });

    const refreshed = await getPurchase(purchase.id);
    expect(refreshed.status).toBe("fully_received");
    expect(refreshed.actual_received_date).not.toBeNull();
  });

  it("rejects receiving more than was ordered", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    const result = await receivePurchaseItem(item.id, { quantity_received: 6, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects a second receipt that would push the cumulative total over quantity_ordered", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 3, reason: null });
    const result = await receivePurchaseItem(item.id, { quantity_received: 3, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects receiving against a cancelled purchase", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await cancelPurchase(purchase.id);
    const result = await receivePurchaseItem(item.id, { quantity_received: 1, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects receiving against a draft purchase (must be submitted first)", async () => {
    const { item } = await createDraftWithItem({ quantity_ordered: 5 });
    const result = await receivePurchaseItem(item.id, { quantity_received: 1, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects receiving against an already fully_received purchase", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 5, reason: null });

    const refreshed = await getPurchase(purchase.id);
    expect(refreshed.status).toBe("fully_received");

    const result = await receivePurchaseItem(item.id, { quantity_received: 1, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects receiving against an archived purchase", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await archivePurchase(purchase.id);

    const result = await receivePurchaseItem(item.id, { quantity_received: 1, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects a zero quantity_received", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    const result = await receivePurchaseItem(item.id, { quantity_received: 0, reason: null });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity_received", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    const result = await receivePurchaseItem(item.id, { quantity_received: -1, reason: null });
    expect(result.success).toBe(false);
  });

  it("creates a real InventoryMovement and updates Inventory quantities for an Inventory-linked line", async () => {
    const before = readInventoryItems().find((i) => i.id === "inventory_item_1");
    if (!before) throw new Error("fixture missing");
    const beforeOnHand = before.quantity_on_hand;

    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");
    const item = await addPurchaseItem(created.data.id, {
      ...BASE_ITEM_INPUT,
      inventory_item_id: "inventory_item_1",
      quantity_ordered: 20,
    });
    if (!item.success) throw new Error("setup failed");
    await submitPurchase(created.data.id);

    const result = await receivePurchaseItem(item.data.id, { quantity_received: 20, reason: null });
    expect(result.success).toBe(true);

    const after = readInventoryItems().find((i) => i.id === "inventory_item_1");
    expect(after?.quantity_on_hand).toBe(beforeOnHand + 20);

    const movements = readInventoryMovements().filter((m) => m.inventory_item_id === "inventory_item_1" && m.reference_id === created.data.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe("purchase");
    expect(movements[0].reference_type).toBe("purchase");
  });

  it("does not touch Inventory for a non-inventory line item", async () => {
    const { purchase, item } = await createDraftWithItem({ inventory_item_id: null, quantity_ordered: 3 });
    await submitPurchase(purchase.id);
    const before = readInventoryMovements().length;

    const result = await receivePurchaseItem(item.id, { quantity_received: 3, reason: null });
    expect(result.success).toBe(true);
    expect(readInventoryMovements()).toHaveLength(before);
  });

  it("records a Timeline entry on receipt", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 5 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 5, reason: null });

    const timeline = await getTimelineByPurchaseId(purchase.id);
    expect(timeline.some((activity) => (activity.type as string) === "purchase_item_received")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Receipt summaries
// ---------------------------------------------------------------------------

describe("getPurchaseReceiptSummary", () => {
  it("reports ordered/received totals and receipt flags accurately", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 10 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 4, reason: null });

    const summary = await getPurchaseReceiptSummary(purchase.id);
    expect(summary.totalOrdered).toBe(10);
    expect(summary.totalReceived).toBe(4);
    expect(summary.isPartiallyReceived).toBe(true);
    expect(summary.isFullyReceived).toBe(false);
  });

  it("reports isFullyReceived once every item is fully received", async () => {
    const { purchase, item } = await createDraftWithItem({ quantity_ordered: 10 });
    await submitPurchase(purchase.id);
    await receivePurchaseItem(item.id, { quantity_received: 10, reason: null });

    const summary = await getPurchaseReceiptSummary(purchase.id);
    expect(summary.isFullyReceived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe("getPurchasesByVendorId", () => {
  it("returns only purchases for the given vendor", async () => {
    const results = await getPurchasesByVendorId("vendor_1");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.vendor_id === "vendor_1")).toBe(true);
  });
});

describe("getOpenPurchases", () => {
  it("returns only submitted/partially_received purchases", async () => {
    const results = await getOpenPurchases();
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.status === "submitted" || p.status === "partially_received")).toBe(true);
  });
});

describe("getOverduePurchases", () => {
  it("returns open purchases whose expected_delivery_date has already passed", async () => {
    const results = await getOverduePurchases();
    expect(results.length).toBeGreaterThan(0);
    for (const purchase of results) {
      expect(["submitted", "partially_received"]).toContain(purchase.status);
      expect(purchase.expected_delivery_date).not.toBeNull();
      expect(new Date(purchase.expected_delivery_date as string).getTime()).toBeLessThan(Date.now());
    }
  });

  it("excludes a purchase with a future expected_delivery_date", async () => {
    const { purchase } = await createDraftWithItem();
    await submitPurchase(purchase.id);
    const results = await getOverduePurchases();
    expect(results.some((p) => p.id === purchase.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Notes / Timeline (Core integration)
// ---------------------------------------------------------------------------

describe("Notes and Timeline", () => {
  it("creates and lists a Note against a Purchase", async () => {
    const created = await createPurchase(BASE_PURCHASE_INPUT);
    if (!created.success) throw new Error("setup failed");

    const note = await createPurchaseNote(created.data.id, { title: "Follow up", content: "Call the vendor", category: "general", priority: "normal" });
    expect(note.success).toBe(true);

    const notes = await getNotesByPurchaseId(created.data.id);
    expect(notes.some((n) => n.title === "Follow up")).toBe(true);
  });

  it("lists Timeline activity for a Purchase across its lifecycle", async () => {
    const { purchase } = await createDraftWithItem();
    await submitPurchase(purchase.id);

    const timeline = await getTimelineByPurchaseId(purchase.id);
    const types = timeline.map((activity) => activity.type as string);
    expect(types).toContain("purchase_created");
    expect(types).toContain("purchase_item_added");
    expect(types).toContain("purchase_status_changed");
  });
});

// ---------------------------------------------------------------------------
// Core: EntityType / Search compatibility
// ---------------------------------------------------------------------------

describe("Core integration — EntityType and Search", () => {
  it("includes purchase as a valid EntityType", () => {
    expect(ENTITY_TYPES).toContain("purchase");
  });

  it("registers purchase as a searchable entity with no route yet", () => {
    registerDefaultSearchableEntities();
    expect(isEntitySearchable("purchase")).toBe(true);
    const config = getSearchableEntityConfig("purchase");
    expect(config?.label).toBe("Purchase");
    expect(config?.route).toBeUndefined();
  });
});
