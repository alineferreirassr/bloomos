import type { InventoryItem } from "@/types/inventoryItem";

/**
 * Pure — no I/O. Mirrors modules/documents/documentStats.ts's
 * computeDocumentOwnerSummary: a client-side rollup over arrays the caller
 * already fetched (listInventoryItems({includeArchived:true}) +
 * getLowStockInventoryItems() + getDamagedOrUnderRepairInventoryItems()),
 * not a new repository/backend summary method. No financial valuation is
 * included — unit_cost/replacement_cost/rental_value aren't rolled up here
 * since no reliable "total inventory value" rule exists in the domain model
 * yet (a consumable's unit_cost times quantity is a real total, but a
 * reusable item's replacement_cost isn't the same kind of number, and mixing
 * them would misrepresent the workspace's holdings).
 */
export interface InventorySummary {
  active: number;
  lowStock: number;
  damagedOrUnderRepair: number;
  archived: number;
}

/** Same rule as getInventoryAvailability's is_low_stock / getLowStockItems — the single place the list/detail UI checks this, so it never drifts from the repository's own definition. */
export function isInventoryItemLowStock(item: InventoryItem): boolean {
  return item.reorder_level !== null && item.quantity_available <= item.reorder_level;
}

export function computeInventorySummary(
  allItems: InventoryItem[],
  lowStockItems: InventoryItem[],
  damagedOrUnderRepairItems: InventoryItem[],
): InventorySummary {
  return {
    active: allItems.filter((item) => item.status === "active").length,
    lowStock: lowStockItems.length,
    damagedOrUnderRepair: damagedOrUnderRepairItems.length,
    archived: allItems.filter((item) => item.status === "archived").length,
  };
}
