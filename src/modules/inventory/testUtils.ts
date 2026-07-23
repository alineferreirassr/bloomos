import type { InventoryItem } from "@/types/inventoryItem";

/** Test-only fixture factory — not imported by any app code. */
export function makeInventoryItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    workspace_id: "workspace-1",
    name: "Ivory Taper Candle",
    description: null,
    sku: "CANDLE-IVORY-01",
    category: "Candles",
    subcategory: null,
    item_type: "consumable",
    tags: [],
    status: "active",
    condition: null,
    unit_of_measure: "each",
    quantity_on_hand: 100,
    quantity_available: 80,
    quantity_reserved: 20,
    reorder_level: 20,
    target_stock_level: 150,
    unit_cost: 250,
    replacement_cost: null,
    rental_value: null,
    storage_location: "Warehouse A",
    bin_location: null,
    primary_vendor_id: null,
    purchase_date: null,
    last_inventory_check_at: null,
    notes: null,
    image_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}
