import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveInventoryItem,
  createInventoryItem,
  getDamagedOrUnderRepairInventoryItems,
  getInventoryAvailability,
  getInventoryItem,
  getLowStockInventoryItems,
  listInventoryItems,
  listInventoryMovements,
  recordInventoryMovement,
  resetAllMockData,
  restoreInventoryItem,
  updateInventoryItem,
} from "@/lib/data";
import { getCoreAuditLogService } from "@/core/audit";
import { getSearchableEntityConfig, isEntitySearchable } from "@/core/search/registry";
import { registerDefaultSearchableEntities } from "@/core/search/defaultRegistrations";
import { ENTITY_TYPES } from "@/core/enums/entityType";
import { MEDIA_ASSET_OWNER_TYPES, LIVE_MEDIA_ASSET_OWNER_TYPES } from "@/lib/media/ownerTypes";
import { readInventoryItems, writeInventoryItems } from "@/lib/data/mock/inventoryItemsStore";
import type { CreateInventoryItemInput, InventoryItemInput } from "@/modules/inventory/schema";

const validConsumableInput: CreateInventoryItemInput = {
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
  initial_quantity: 50,
};

const validReusableInput: CreateInventoryItemInput = {
  ...validConsumableInput,
  name: "Gold Chiavari Chairs",
  sku: "CHAIR-GLD",
  category: "Furniture",
  item_type: "reusable",
  condition: "new",
  unit_cost: 8500,
  replacement_cost: 9000,
  rental_value: 1200,
  initial_quantity: 40,
};

beforeEach(() => {
  resetAllMockData();
});

describe("createInventoryItem", () => {
  it("creates a consumable item and applies its initial_quantity as an initial_stock movement", async () => {
    const result = await createInventoryItem(validConsumableInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.quantity_on_hand).toBe(50);
    expect(result.data.quantity_available).toBe(50);
    expect(result.data.quantity_reserved).toBe(0);
    expect(result.data.item_type).toBe("consumable");
    expect(result.data.condition).toBeNull();

    const movements = await listInventoryMovements(result.data.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].movement_type).toBe("initial_stock");
    expect(movements[0].quantity_after).toBe(50);
  });

  it("creates a reusable item with a condition and zero initial quantity when omitted", async () => {
    const result = await createInventoryItem({ ...validReusableInput, initial_quantity: 0 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.quantity_on_hand).toBe(0);
    expect(result.data.condition).toBe("new");
    expect(await listInventoryMovements(result.data.id)).toEqual([]);
  });

  it("rejects a consumable item with a non-null condition", async () => {
    const result = await createInventoryItem({ ...validConsumableInput, condition: "new" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", async () => {
    const result = await createInventoryItem({ ...validConsumableInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative unit_cost", async () => {
    const result = await createInventoryItem({ ...validConsumableInput, unit_cost: -100 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative reorder_level", async () => {
    const result = await createInventoryItem({ ...validConsumableInput, reorder_level: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate SKU within the same workspace with a field-level error", async () => {
    const first = await createInventoryItem(validConsumableInput);
    expect(first.success).toBe(true);

    const second = await createInventoryItem({ ...validConsumableInput, name: "A different name" });
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.fieldErrors?.sku).toMatch(/already in use/i);
    }
  });
});

describe("workspace isolation", () => {
  it("excludes items belonging to a different workspace from listInventoryItems", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const foreignItem = { ...created.data, id: "foreign_item", workspace_id: "ws_other" };
    writeInventoryItems([...readInventoryItems(), foreignItem]);

    const items = await listInventoryItems({ includeArchived: true });
    expect(items.some((i) => i.id === "foreign_item")).toBe(false);
  });

  it("excludes a different workspace's items from getLowStockInventoryItems and getDamagedOrUnderRepairInventoryItems", async () => {
    const created = await createInventoryItem({ ...validReusableInput, condition: "damaged", reorder_level: 100, initial_quantity: 1 });
    if (!created.success) throw new Error("setup failed");

    const foreignItem = { ...created.data, id: "foreign_item_2", workspace_id: "ws_other" };
    writeInventoryItems([...readInventoryItems(), foreignItem]);

    expect((await getLowStockInventoryItems()).some((i) => i.id === "foreign_item_2")).toBe(false);
    expect((await getDamagedOrUnderRepairInventoryItems()).some((i) => i.id === "foreign_item_2")).toBe(false);
  });
});

describe("stock movements — increase", () => {
  it("purchase increases both on-hand and available", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "purchase",
      quantity: 25,
      reason: "Restock ahead of peak season",
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(75);
    expect(item.quantity_available).toBe(75);
  });
});

describe("stock movements — decrease", () => {
  it("adjustment_decrease reduces both on-hand and available", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "adjustment_decrease",
      quantity: 10,
      reason: "Count correction",
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(40);
    expect(item.quantity_available).toBe(40);
  });

  it("damage/loss/disposal each reduce on-hand and available", async () => {
    for (const movementType of ["damage", "loss", "disposal"] as const) {
      const created = await createInventoryItem({ ...validConsumableInput, sku: `${validConsumableInput.sku}-${movementType}` });
      if (!created.success) throw new Error("setup failed");

      const result = await recordInventoryMovement(created.data.id, {
        movement_type: movementType,
        quantity: 5,
        reason: null,
        reference_type: null,
        reference_id: null,
      });
      expect(result.success).toBe(true);

      const item = await getInventoryItem(created.data.id);
      expect(item.quantity_on_hand).toBe(45);
      expect(item.quantity_available).toBe(45);
    }
  });
});

describe("reservations", () => {
  it("reservation moves stock from available to reserved without changing on-hand", async () => {
    const created = await createInventoryItem(validReusableInput);
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "reservation",
      quantity: 15,
      reason: "Reserved for the Whitfield wedding",
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(40);
    expect(item.quantity_available).toBe(25);
    expect(item.quantity_reserved).toBe(15);
  });

  it("reservation_release returns stock from reserved to available without changing on-hand", async () => {
    const created = await createInventoryItem(validReusableInput);
    if (!created.success) throw new Error("setup failed");
    await recordInventoryMovement(created.data.id, { movement_type: "reservation", quantity: 15, reason: null, reference_type: null, reference_id: null });

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "reservation_release",
      quantity: 15,
      reason: "Event postponed",
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(40);
    expect(item.quantity_available).toBe(40);
    expect(item.quantity_reserved).toBe(0);
  });

  it("event_checkout consumes a reservation and removes stock from hand", async () => {
    const created = await createInventoryItem(validReusableInput);
    if (!created.success) throw new Error("setup failed");
    await recordInventoryMovement(created.data.id, { movement_type: "reservation", quantity: 15, reason: null, reference_type: null, reference_id: null });

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "event_checkout",
      quantity: 15,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(25);
    expect(item.quantity_available).toBe(25);
    expect(item.quantity_reserved).toBe(0);
  });

  it("event_return restores on-hand and available", async () => {
    const created = await createInventoryItem(validReusableInput);
    if (!created.success) throw new Error("setup failed");
    await recordInventoryMovement(created.data.id, { movement_type: "reservation", quantity: 10, reason: null, reference_type: null, reference_id: null });
    await recordInventoryMovement(created.data.id, { movement_type: "event_checkout", quantity: 10, reason: null, reference_type: null, reference_id: null });

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "event_return",
      quantity: 10,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(true);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(40);
    expect(item.quantity_available).toBe(40);
  });
});

describe("prevention of negative inventory", () => {
  it("rejects a decrease that would take on-hand below zero", async () => {
    const created = await createInventoryItem({ ...validConsumableInput, initial_quantity: 5 });
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "adjustment_decrease",
      quantity: 10,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(false);

    const item = await getInventoryItem(created.data.id);
    expect(item.quantity_on_hand).toBe(5);
  });

  it("rejects reserving more than is available", async () => {
    const created = await createInventoryItem({ ...validReusableInput, initial_quantity: 5 });
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "reservation",
      quantity: 10,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-quantity movement at the schema level", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "purchase",
      quantity: 0,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects movements against an archived item", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await archiveInventoryItem(created.data.id);

    const result = await recordInventoryMovement(created.data.id, {
      movement_type: "purchase",
      quantity: 5,
      reason: null,
      reference_type: null,
      reference_id: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("movement-history immutability", () => {
  it("accumulates every movement rather than overwriting history", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    await recordInventoryMovement(created.data.id, { movement_type: "purchase", quantity: 10, reason: null, reference_type: null, reference_id: null });
    await recordInventoryMovement(created.data.id, { movement_type: "adjustment_decrease", quantity: 5, reason: null, reference_type: null, reference_id: null });

    const movements = await listInventoryMovements(created.data.id);
    expect(movements).toHaveLength(3); // initial_stock + purchase + adjustment_decrease
    expect(movements.map((m) => m.movement_type).sort()).toEqual(["adjustment_decrease", "initial_stock", "purchase"]);
  });

  it("has no update or delete method on the repository interface (immutability enforced at the type level)", async () => {
    const dataModule = await import("@/lib/data");
    expect((dataModule as unknown as Record<string, unknown>).updateInventoryMovement).toBeUndefined();
    expect((dataModule as unknown as Record<string, unknown>).deleteInventoryMovement).toBeUndefined();
  });
});

describe("low-stock queries", () => {
  it("identifies items whose available quantity has fallen to or below their reorder_level", async () => {
    const created = await createInventoryItem({ ...validConsumableInput, reorder_level: 45, initial_quantity: 50 });
    if (!created.success) throw new Error("setup failed");

    expect((await getLowStockInventoryItems()).some((i) => i.id === created.data.id)).toBe(false);

    await recordInventoryMovement(created.data.id, { movement_type: "adjustment_decrease", quantity: 10, reason: null, reference_type: null, reference_id: null });

    expect((await getLowStockInventoryItems()).some((i) => i.id === created.data.id)).toBe(true);
  });

  it("never flags an item with no reorder_level set", async () => {
    const created = await createInventoryItem({ ...validConsumableInput, reorder_level: null, initial_quantity: 1 });
    if (!created.success) throw new Error("setup failed");

    expect((await getLowStockInventoryItems()).some((i) => i.id === created.data.id)).toBe(false);
  });
});

describe("archive and restore", () => {
  it("archives an active item, excluding it from the default list", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const archived = await archiveInventoryItem(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) {
      expect(archived.data.status).toBe("archived");
      expect(archived.data.archived_at).not.toBeNull();
    }

    const defaultList = await listInventoryItems();
    expect(defaultList.some((i) => i.id === created.data.id)).toBe(false);

    const withArchived = await listInventoryItems({ includeArchived: true });
    expect(withArchived.some((i) => i.id === created.data.id)).toBe(true);
  });

  it("fails to archive an already-archived item", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await archiveInventoryItem(created.data.id);

    const result = await archiveInventoryItem(created.data.id);
    expect(result.success).toBe(false);
  });

  it("restores an archived item back to active", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await archiveInventoryItem(created.data.id);

    const restored = await restoreInventoryItem(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.status).toBe("active");
      expect(restored.data.archived_at).toBeNull();
    }
  });

  it("fails to restore an item that isn't archived", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const result = await restoreInventoryItem(created.data.id);
    expect(result.success).toBe(false);
  });

  it("blocks a normal field update on an archived item", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await archiveInventoryItem(created.data.id);

    const update: InventoryItemInput = { ...validConsumableInput, name: "Renamed" };
    const result = await updateInventoryItem(created.data.id, update);
    expect(result.success).toBe(false);
  });

  it("rejects renaming an item's SKU to one already used by another item in the workspace", async () => {
    const first = await createInventoryItem(validConsumableInput);
    const second = await createInventoryItem({ ...validConsumableInput, name: "Other Candle", sku: "OTHER-SKU" });
    if (!first.success || !second.success) throw new Error("setup failed");

    const result = await updateInventoryItem(second.data.id, { ...validConsumableInput, sku: validConsumableInput.sku });
    expect(result.success).toBe(false);
  });
});

describe("damaged/under-repair filtering", () => {
  it("identifies items with condition damaged or under_repair", async () => {
    const damaged = await createInventoryItem({ ...validReusableInput, condition: "damaged" });
    const underRepair = await createInventoryItem({ ...validReusableInput, name: "Other", sku: "OTHER", condition: "under_repair" });
    const fine = await createInventoryItem({ ...validReusableInput, name: "Fine", sku: "FINE", condition: "good" });
    if (!damaged.success || !underRepair.success || !fine.success) throw new Error("setup failed");

    const results = await getDamagedOrUnderRepairInventoryItems();
    const ids = results.map((i) => i.id);
    expect(ids).toContain(damaged.data.id);
    expect(ids).toContain(underRepair.data.id);
    expect(ids).not.toContain(fine.data.id);
  });

  it("never includes a consumable item, which always has a null condition", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    expect((await getDamagedOrUnderRepairInventoryItems()).some((i) => i.id === created.data.id)).toBe(false);
  });
});

describe("getInventoryAvailability", () => {
  it("reports current quantities and low-stock status together", async () => {
    const created = await createInventoryItem({ ...validConsumableInput, reorder_level: 45, initial_quantity: 50 });
    if (!created.success) throw new Error("setup failed");

    const availability = await getInventoryAvailability(created.data.id);
    expect(availability).toEqual({ quantity_on_hand: 50, quantity_available: 50, quantity_reserved: 0, is_low_stock: false });
  });
});

describe("Core Audit Log integration", () => {
  it("records an inventory_item_created audit event", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");

    const entries = await getCoreAuditLogService().getAuditLogForOwner(created.data.workspace_id, "inventory_item", created.data.id);
    expect(entries.some((e) => e.action === "inventory_item_created")).toBe(true);
  });

  it("records an inventory_movement_recorded audit event with before/after on-hand quantities", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await recordInventoryMovement(created.data.id, { movement_type: "purchase", quantity: 10, reason: null, reference_type: null, reference_id: null });

    const entries = await getCoreAuditLogService().getAuditLogForOwner(created.data.workspace_id, "inventory_item", created.data.id);
    const movementEntry = entries.find((e) => e.action === "inventory_movement_recorded" && e.after?.movement_type === "purchase");
    expect(movementEntry?.before).toEqual({ quantity_on_hand: 50 });
    expect(movementEntry?.after).toMatchObject({ quantity_on_hand: 60 });
  });

  it("records inventory_item_archived and inventory_item_restored audit events", async () => {
    const created = await createInventoryItem(validConsumableInput);
    if (!created.success) throw new Error("setup failed");
    await archiveInventoryItem(created.data.id);
    await restoreInventoryItem(created.data.id);

    const entries = await getCoreAuditLogService().getAuditLogForOwner(created.data.workspace_id, "inventory_item", created.data.id);
    expect(entries.some((e) => e.action === "inventory_item_archived")).toBe(true);
    expect(entries.some((e) => e.action === "inventory_item_restored")).toBe(true);
  });
});

describe("Search registration", () => {
  it("registers inventory_item as searchable with a route", () => {
    registerDefaultSearchableEntities();
    expect(isEntitySearchable("inventory_item")).toBe(true);
    expect(getSearchableEntityConfig("inventory_item")?.route?.("item_1")).toBe("/inventory/item_1");
  });
});

describe("EntityType backward compatibility", () => {
  it("uses inventory_item, not the old inventory placeholder, in the shared EntityType union", () => {
    expect(ENTITY_TYPES).toContain("inventory_item");
    expect(ENTITY_TYPES).not.toContain("inventory");
  });

  it("is present in the Media Library's aspirational owner-type list and, now that inventory_items has a live Supabase table, the live/enforced list too", () => {
    expect(MEDIA_ASSET_OWNER_TYPES).toContain("inventory_item");
    expect(LIVE_MEDIA_ASSET_OWNER_TYPES).toContain("inventory_item");
  });
});
