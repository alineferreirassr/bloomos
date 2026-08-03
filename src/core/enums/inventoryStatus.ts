export const INVENTORY_STATUSES = ["active", "inactive", "archived"] as const;

export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};
