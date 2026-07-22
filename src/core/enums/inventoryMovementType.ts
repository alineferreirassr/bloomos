/**
 * Every reason an InventoryItem's quantity can change — the append-only
 * ledger (`InventoryMovement`) records one of these per row instead of
 * quantity_on_hand ever being overwritten directly. Event integration
 * (`event_checkout`/`event_return`) is reserved here but not implemented
 * this phase — see docs/inventory.md.
 */
export const INVENTORY_MOVEMENT_TYPES = [
  "initial_stock",
  "purchase",
  "adjustment_increase",
  "adjustment_decrease",
  "reservation",
  "reservation_release",
  "event_checkout",
  "event_return",
  "damage",
  "loss",
  "disposal",
] as const;

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  initial_stock: "Initial stock",
  purchase: "Purchase",
  adjustment_increase: "Adjustment (increase)",
  adjustment_decrease: "Adjustment (decrease)",
  reservation: "Reservation",
  reservation_release: "Reservation released",
  event_checkout: "Checked out for Event",
  event_return: "Returned from Event",
  damage: "Damage",
  loss: "Loss",
  disposal: "Disposal",
};
