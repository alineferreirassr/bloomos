import { describe, expect, it } from "vitest";
import {
  canTransitionInventoryStatus,
  isConditionValidForItemType,
  validateInventoryQuantities,
  getInventoryMovementDelta,
} from "@/core/workflows/inventoryWorkflow";

describe("canTransitionInventoryStatus", () => {
  it("allows active <-> inactive freely", () => {
    expect(canTransitionInventoryStatus("active", "inactive")).toBe(true);
    expect(canTransitionInventoryStatus("inactive", "active")).toBe(true);
  });

  it("rejects transitioning to the same status", () => {
    expect(canTransitionInventoryStatus("active", "active")).toBe(false);
  });

  it("rejects reaching archived through the generic setter", () => {
    expect(canTransitionInventoryStatus("active", "archived")).toBe(false);
    expect(canTransitionInventoryStatus("inactive", "archived")).toBe(false);
  });

  it("rejects leaving archived through the generic setter", () => {
    expect(canTransitionInventoryStatus("archived", "active")).toBe(false);
    expect(canTransitionInventoryStatus("archived", "inactive")).toBe(false);
  });
});

describe("isConditionValidForItemType", () => {
  it("requires null condition for a consumable item", () => {
    expect(isConditionValidForItemType("consumable", null)).toBe(true);
    expect(isConditionValidForItemType("consumable", "new")).toBe(false);
    expect(isConditionValidForItemType("consumable", "damaged")).toBe(false);
  });

  it("allows null or any condition value for a reusable item", () => {
    expect(isConditionValidForItemType("reusable", null)).toBe(true);
    expect(isConditionValidForItemType("reusable", "new")).toBe(true);
    expect(isConditionValidForItemType("reusable", "retired")).toBe(true);
  });
});

describe("validateInventoryQuantities", () => {
  it("accepts a valid, consistent set of quantities", () => {
    expect(validateInventoryQuantities({ quantity_on_hand: 10, quantity_available: 7, quantity_reserved: 3 })).toBeNull();
  });

  it("rejects any negative quantity", () => {
    expect(validateInventoryQuantities({ quantity_on_hand: -1, quantity_available: 0, quantity_reserved: 0 })).not.toBeNull();
    expect(validateInventoryQuantities({ quantity_on_hand: 5, quantity_available: -1, quantity_reserved: 0 })).not.toBeNull();
    expect(validateInventoryQuantities({ quantity_on_hand: 5, quantity_available: 0, quantity_reserved: -1 })).not.toBeNull();
  });

  it("rejects quantity_available exceeding quantity_on_hand", () => {
    expect(validateInventoryQuantities({ quantity_on_hand: 5, quantity_available: 6, quantity_reserved: 0 })).not.toBeNull();
  });

  it("rejects quantity_reserved exceeding quantity_on_hand", () => {
    expect(validateInventoryQuantities({ quantity_on_hand: 5, quantity_available: 0, quantity_reserved: 6 })).not.toBeNull();
  });
});

describe("getInventoryMovementDelta", () => {
  it("initial_stock/purchase/adjustment_increase/event_return increase on-hand and available equally", () => {
    for (const type of ["initial_stock", "purchase", "adjustment_increase", "event_return"] as const) {
      expect(getInventoryMovementDelta(type, 5)).toEqual({ onHand: 5, available: 5, reserved: 0 });
    }
  });

  it("adjustment_decrease/damage/loss/disposal decrease on-hand and available equally", () => {
    for (const type of ["adjustment_decrease", "damage", "loss", "disposal"] as const) {
      expect(getInventoryMovementDelta(type, 4)).toEqual({ onHand: -4, available: -4, reserved: 0 });
    }
  });

  it("reservation moves stock from available to reserved without touching on-hand", () => {
    expect(getInventoryMovementDelta("reservation", 3)).toEqual({ onHand: 0, available: -3, reserved: 3 });
  });

  it("reservation_release moves stock from reserved back to available without touching on-hand", () => {
    expect(getInventoryMovementDelta("reservation_release", 3)).toEqual({ onHand: 0, available: 3, reserved: -3 });
  });

  it("event_checkout consumes a reservation and removes stock from hand, leaving available untouched", () => {
    expect(getInventoryMovementDelta("event_checkout", 2)).toEqual({ onHand: -2, available: 0, reserved: -2 });
  });
});
