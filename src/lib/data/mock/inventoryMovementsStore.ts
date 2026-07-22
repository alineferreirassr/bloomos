import type { InventoryMovement } from "@/types/inventoryMovement";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const SEED_INVENTORY_MOVEMENTS: InventoryMovement[] = [
  {
    id: "inventory_movement_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_1",
    movement_type: "initial_stock",
    quantity: 240,
    quantity_before: 0,
    quantity_after: 240,
    reason: "Initial stock on creation",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2026-05-01T09:00:00.000Z",
    created_at: "2026-05-01T09:00:00.000Z",
  },
  {
    id: "inventory_movement_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_1",
    movement_type: "reservation",
    quantity: 30,
    quantity_before: 240,
    quantity_after: 240,
    reason: "Reserved for an upcoming ceremony",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2026-07-01T09:00:00.000Z",
    created_at: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "inventory_movement_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_2",
    movement_type: "initial_stock",
    quantity: 3,
    quantity_before: 0,
    quantity_after: 3,
    reason: "Initial stock on creation",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2025-11-14T10:00:00.000Z",
    created_at: "2025-11-14T10:00:00.000Z",
  },
  {
    id: "inventory_movement_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_2",
    movement_type: "reservation",
    quantity: 1,
    quantity_before: 3,
    quantity_after: 3,
    reason: "Reserved for an upcoming ceremony",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2026-07-10T14:00:00.000Z",
    created_at: "2026-07-10T14:00:00.000Z",
  },
  {
    id: "inventory_movement_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_3",
    movement_type: "initial_stock",
    quantity: 1,
    quantity_before: 0,
    quantity_after: 1,
    reason: "Initial stock on creation",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2024-02-20T10:00:00.000Z",
    created_at: "2024-02-20T10:00:00.000Z",
  },
  {
    id: "inventory_movement_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_3",
    movement_type: "damage",
    quantity: 1,
    quantity_before: 1,
    quantity_after: 0,
    reason: "Torn armrest discovered during post-event teardown",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2026-07-15T11:00:00.000Z",
    created_at: "2026-07-15T11:00:00.000Z",
  },
  {
    id: "inventory_movement_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_4",
    movement_type: "initial_stock",
    quantity: 60,
    quantity_before: 0,
    quantity_after: 60,
    reason: "Initial stock on creation",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2025-08-01T09:00:00.000Z",
    created_at: "2025-08-01T09:00:00.000Z",
  },
  {
    id: "inventory_movement_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    inventory_item_id: "inventory_item_5",
    movement_type: "initial_stock",
    quantity: 4,
    quantity_before: 0,
    quantity_after: 4,
    reason: "Initial stock on creation",
    reference_type: null,
    reference_id: null,
    performed_by: "Aline Ferreira",
    occurred_at: "2023-03-10T09:00:00.000Z",
    created_at: "2023-03-10T09:00:00.000Z",
  },
];

let movements: InventoryMovement[] = SEED_INVENTORY_MOVEMENTS.map((movement) => ({ ...movement }));

export function readInventoryMovements(): InventoryMovement[] {
  return movements;
}

/**
 * The only write path — deliberately no `writeInventoryMovements` export,
 * so nothing outside this file can replace or edit a movement once
 * appended. This is the store-level half of "append-only at the
 * domain/repository contract level"; `InventoryRepository`'s own interface
 * (no update/delete method) is the other half.
 */
export function appendInventoryMovement(movement: InventoryMovement): void {
  movements = [...movements, movement];
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetInventoryMovementsStore(): void {
  movements = SEED_INVENTORY_MOVEMENTS.map((movement) => ({ ...movement }));
}
