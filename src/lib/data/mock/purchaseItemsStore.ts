import type { PurchaseItem } from "@/types/purchaseItem";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * Line items for purchasesStore.ts's seed Purchases — covers both
 * Inventory-linked lines (inventory_item_id set, sku snapshotted from the
 * real Inventory item) and non-inventory lines (inventory_item_id null: a
 * rush fee, a one-off rental, a deposit).
 */
const SEED_PURCHASE_ITEMS: PurchaseItem[] = [
  // purchase_1 (draft) — one Inventory-linked line, one non-inventory line.
  {
    id: "purchase_item_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_1",
    inventory_item_id: "inventory_item_1",
    name: "Ivory Taper Candles (12in)",
    sku: "CAN-TAP-IVR-12",
    quantity_ordered: 200,
    quantity_received: 0,
    unit_cost_minor: 125,
    line_subtotal_minor: 25000,
    display_order: 0,
    created_at: "2026-07-15T09:00:00.000Z",
    updated_at: "2026-07-15T09:00:00.000Z",
  },
  {
    id: "purchase_item_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_1",
    inventory_item_id: null,
    name: "Rush processing fee",
    sku: null,
    quantity_ordered: 1,
    quantity_received: 0,
    unit_cost_minor: 5000,
    line_subtotal_minor: 5000,
    display_order: 1,
    created_at: "2026-07-15T09:00:00.000Z",
    updated_at: "2026-07-15T09:00:00.000Z",
  },
  // purchase_2 (submitted, overdue) — one Inventory-linked line.
  {
    id: "purchase_item_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_2",
    inventory_item_id: "inventory_item_1",
    name: "Ivory Taper Candles (12in)",
    sku: "CAN-TAP-IVR-12",
    quantity_ordered: 100,
    quantity_received: 0,
    unit_cost_minor: 125,
    line_subtotal_minor: 12500,
    display_order: 0,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
  },
  // purchase_3 (partially_received) — arch frames half-received, settee not yet received.
  {
    id: "purchase_item_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_3",
    inventory_item_id: "inventory_item_2",
    name: "Brass Arch Frame (8ft, round-top)",
    sku: "ARCH-BRS-8FT",
    quantity_ordered: 4,
    quantity_received: 2,
    unit_cost_minor: 45000,
    line_subtotal_minor: 180000,
    display_order: 0,
    created_at: "2026-06-15T09:00:00.000Z",
    updated_at: "2026-07-05T11:00:00.000Z",
  },
  {
    id: "purchase_item_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_3",
    inventory_item_id: "inventory_item_3",
    name: "Vintage Velvet Settee (emerald)",
    sku: "FURN-SET-EMR",
    quantity_ordered: 2,
    quantity_received: 0,
    unit_cost_minor: 120000,
    line_subtotal_minor: 240000,
    display_order: 1,
    created_at: "2026-06-15T09:00:00.000Z",
    updated_at: "2026-06-15T09:00:00.000Z",
  },
  // purchase_4 (fully_received) — one Inventory-linked line, fully received.
  {
    id: "purchase_item_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_4",
    inventory_item_id: "inventory_item_1",
    name: "Ivory Taper Candles (12in)",
    sku: "CAN-TAP-IVR-12",
    quantity_ordered: 150,
    quantity_received: 150,
    unit_cost_minor: 125,
    line_subtotal_minor: 18750,
    display_order: 0,
    created_at: "2026-05-20T09:00:00.000Z",
    updated_at: "2026-05-30T14:00:00.000Z",
  },
  // purchase_5 (cancelled) — one non-inventory line, never received.
  {
    id: "purchase_item_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_5",
    inventory_item_id: null,
    name: "Custom floral arch rental — one-off",
    sku: null,
    quantity_ordered: 1,
    quantity_received: 0,
    unit_cost_minor: 35000,
    line_subtotal_minor: 35000,
    display_order: 0,
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-01T09:00:00.000Z",
  },
  // purchase_6 (archived, was fully received before archiving).
  {
    id: "purchase_item_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_6",
    inventory_item_id: "inventory_item_1",
    name: "Ivory Taper Candles (12in)",
    sku: "CAN-TAP-IVR-12",
    quantity_ordered: 80,
    quantity_received: 80,
    unit_cost_minor: 125,
    line_subtotal_minor: 10000,
    display_order: 0,
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-09T13:00:00.000Z",
  },
  // purchase_7 (submitted, archived Vendor) — one non-inventory line (deposit).
  {
    id: "purchase_item_9",
    workspace_id: CURRENT_WORKSPACE_ID,
    purchase_id: "purchase_7",
    inventory_item_id: null,
    name: "Linen rental deposit",
    sku: null,
    quantity_ordered: 1,
    quantity_received: 0,
    unit_cost_minor: 20000,
    line_subtotal_minor: 20000,
    display_order: 0,
    created_at: "2026-07-05T09:00:00.000Z",
    updated_at: "2026-07-05T09:00:00.000Z",
  },
];

let purchaseItems: PurchaseItem[] = SEED_PURCHASE_ITEMS.map((item) => ({ ...item }));

export function readPurchaseItems(): PurchaseItem[] {
  return purchaseItems;
}

export function writePurchaseItems(next: PurchaseItem[]): void {
  purchaseItems = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetPurchaseItemsStore(): void {
  purchaseItems = SEED_PURCHASE_ITEMS.map((item) => ({ ...item }));
}
