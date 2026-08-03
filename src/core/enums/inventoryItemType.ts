/** Every InventoryItem is either bought once and used up, or bought once and reused across many Events. */
export const INVENTORY_ITEM_TYPES = ["consumable", "reusable"] as const;

export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  consumable: "Consumable",
  reusable: "Reusable",
};
