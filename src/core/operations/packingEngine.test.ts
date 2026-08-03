import { describe, expect, it } from "vitest";
import { buildPackingList, classifyPackingCategory, groupPackingListByCategory } from "@/core/operations/packingEngine";
import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { InventoryItem } from "@/types/inventoryItem";

function makeRequirement(overrides: Partial<EventServiceInventoryRequirement> = {}): EventServiceInventoryRequirement {
  return {
    id: "req_1",
    workspace_id: "ws_1",
    event_service_id: "es_1",
    inventory_item_id: null,
    item_name: "Ivory Taper Candle",
    quantity: 12,
    is_fulfilled: false,
    note: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "inv_1",
    workspace_id: "ws_1",
    name: "Ivory Taper Candle",
    description: null,
    sku: null,
    category: "Candles",
    subcategory: null,
    item_type: "consumable",
    tags: [],
    status: "active",
    condition: null,
    unit_of_measure: "each",
    quantity_on_hand: 100,
    quantity_available: 100,
    quantity_reserved: 0,
    reorder_level: 20,
    target_stock_level: null,
    unit_cost: null,
    replacement_cost: null,
    rental_value: null,
    storage_location: null,
    bin_location: null,
    primary_vendor_id: null,
    purchase_date: null,
    last_inventory_check_at: null,
    notes: null,
    image_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides,
  };
}

describe("classifyPackingCategory", () => {
  it("classifies by the matched inventory item's own category text", () => {
    expect(classifyPackingCategory("Ivory Taper Candle", makeInventoryItem({ category: "Candles" }))).toBe("candles");
    expect(classifyPackingCategory("String Lights", makeInventoryItem({ category: "Lighting" }))).toBe("lighting");
  });

  it("falls back to the item name when there's no matched inventory item (a shopping-list item)", () => {
    expect(classifyPackingCategory("Extension Cord 50ft", null)).toBe("extension_cords");
    expect(classifyPackingCategory("Fresh Ranunculus Bouquet", null)).toBe("flowers");
  });

  it("falls back to 'other' when nothing matches, never guesses", () => {
    expect(classifyPackingCategory("Guest Book", null)).toBe("other");
  });
});

describe("buildPackingList", () => {
  it("excludes already-fulfilled requirements", () => {
    const requirements = [makeRequirement({ id: "r1", is_fulfilled: true }), makeRequirement({ id: "r2", is_fulfilled: false })];
    const result = buildPackingList(requirements, new Map());
    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe("Ivory Taper Candle");
  });

  it("marks source as 'inventory' when matched, 'shopping' when not", () => {
    const inventoryItem = makeInventoryItem();
    const requirements = [
      makeRequirement({ id: "r1", inventory_item_id: "inv_1", item_name: "Ivory Taper Candle" }),
      makeRequirement({ id: "r2", inventory_item_id: null, item_name: "Custom Neon Sign" }),
    ];
    const result = buildPackingList(requirements, new Map([["inv_1", inventoryItem]]));
    expect(result.find((i) => i.itemName === "Ivory Taper Candle")?.source).toBe("inventory");
    expect(result.find((i) => i.itemName === "Custom Neon Sign")?.source).toBe("shopping");
  });
});

describe("groupPackingListByCategory", () => {
  it("groups items and omits empty categories", () => {
    const items = buildPackingList(
      [
        makeRequirement({ id: "r1", item_name: "Ivory Taper Candle", inventory_item_id: "inv_1" }),
        makeRequirement({ id: "r2", item_name: "Balloon Arch Kit" }),
      ],
      new Map([["inv_1", makeInventoryItem({ category: "Candles" })]]),
    );
    const grouped = groupPackingListByCategory(items);
    expect(grouped.map((g) => g.category)).toEqual(["candles", "balloons"]);
    expect(grouped.every((g) => g.items.length > 0)).toBe(true);
  });
});
