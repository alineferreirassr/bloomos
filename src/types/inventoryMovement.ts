import type { InventoryMovementType } from "@/core/enums/inventoryMovementType";

/**
 * One append-only ledger entry recording why an InventoryItem's quantity
 * changed. Never updated or deleted once written — see docs/inventory.md's
 * "Append-only movement history" section and `InventoryRepository`'s
 * contract (no update/delete method exists for movements, mirroring
 * `AuditLogRepository`'s immutability-by-construction pattern).
 *
 * `quantity` is always the positive magnitude of the change; direction is
 * determined by `movement_type` (e.g. `adjustment_decrease` subtracts
 * `quantity` from `quantity_before` to get `quantity_after`).
 *
 * `reference_type`/`reference_id` are generic extension points — reserved
 * for a future Event checkout/return (`reference_type: "event"`) or a
 * future Vendor purchase, not populated by anything this phase.
 */
export interface InventoryMovement {
  id: string;
  workspace_id: string;
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  performed_by: string;
  occurred_at: string;
  created_at: string;
}
