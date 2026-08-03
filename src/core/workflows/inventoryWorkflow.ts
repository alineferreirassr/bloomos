import type { InventoryItemType } from "@/core/enums/inventoryItemType";
import type { InventoryStatus } from "@/core/enums/inventoryStatus";
import type { InventoryCondition } from "@/core/enums/inventoryCondition";
import type { InventoryMovementType } from "@/core/enums/inventoryMovementType";

/**
 * `active`/`inactive` are freely inter-transitionable (mirrors Contract's
 * draft/review/ready); `archived` is reachable only through
 * `archiveInventoryItem`/`restoreInventoryItem`, never this generic setter —
 * same terminal-state-via-dedicated-action pattern as every other module
 * (Client, Event, Document).
 */
export function canTransitionInventoryStatus(from: InventoryStatus, to: InventoryStatus): boolean {
  if (from === to) return false;
  if (from === "archived" || to === "archived") return false;
  return true;
}

/**
 * A `consumable` item is used up, never assessed for physical condition — a
 * non-null condition on one is a data error, not a valid "not yet
 * assessed" state. A `reusable` item may be null (not yet assessed) or any
 * `InventoryCondition` value.
 */
export function isConditionValidForItemType(itemType: InventoryItemType, condition: InventoryCondition | null): boolean {
  if (itemType === "consumable") return condition === null;
  return true;
}

export interface InventoryQuantities {
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
}

/**
 * The three core quantity invariants — checked after every mutation, not
 * just at creation, since a movement or a direct edit could otherwise leave
 * the record in an impossible state (more available than on hand, etc.).
 * Returns a human-readable reason, or null when the quantities are valid.
 */
export function validateInventoryQuantities(quantities: InventoryQuantities): string | null {
  const { quantity_on_hand, quantity_available, quantity_reserved } = quantities;
  if (quantity_on_hand < 0 || quantity_available < 0 || quantity_reserved < 0) {
    return "Quantities cannot be negative.";
  }
  if (quantity_available > quantity_on_hand) {
    return "Quantity available cannot exceed quantity on hand.";
  }
  if (quantity_reserved > quantity_on_hand) {
    return "Quantity reserved cannot exceed quantity on hand.";
  }
  return null;
}

export interface InventoryQuantityDelta {
  onHand: number;
  available: number;
  reserved: number;
}

/**
 * How each movement type changes the three tracked quantities — the single
 * place this mapping lives, so the repository never encodes "what a
 * reservation does to the numbers" inline. `quantity` is always the
 * positive magnitude of the movement; the sign here supplies direction.
 *
 * Physical reading of the model: `quantity_on_hand` means "physically in
 * our possession right now" — a reusable item checked out to an Event
 * genuinely isn't on hand until it's returned, so `event_checkout` reduces
 * `quantity_on_hand` and `event_return` restores it. `reservation` only
 * moves stock between `available` and `reserved` (nothing physically
 * leaves); `event_checkout` is what actually consumes a reservation and
 * removes the stock from hand.
 */
export function getInventoryMovementDelta(movementType: InventoryMovementType, quantity: number): InventoryQuantityDelta {
  switch (movementType) {
    case "initial_stock":
    case "purchase":
    case "adjustment_increase":
    case "event_return":
      return { onHand: quantity, available: quantity, reserved: 0 };
    case "adjustment_decrease":
    case "damage":
    case "loss":
    case "disposal":
      return { onHand: -quantity, available: -quantity, reserved: 0 };
    case "reservation":
      return { onHand: 0, available: -quantity, reserved: quantity };
    case "reservation_release":
      return { onHand: 0, available: quantity, reserved: -quantity };
    case "event_checkout":
      return { onHand: -quantity, available: 0, reserved: -quantity };
  }
}
