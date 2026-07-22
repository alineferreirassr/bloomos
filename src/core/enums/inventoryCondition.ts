/** Only meaningful for a `reusable` InventoryItem — a `consumable` item's condition is always null (used up, not assessed). */
export const INVENTORY_CONDITIONS = [
  "new",
  "excellent",
  "good",
  "fair",
  "damaged",
  "under_repair",
  "retired",
] as const;

export type InventoryCondition = (typeof INVENTORY_CONDITIONS)[number];

export const INVENTORY_CONDITION_LABELS: Record<InventoryCondition, string> = {
  new: "New",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  under_repair: "Under Repair",
  retired: "Retired",
};
