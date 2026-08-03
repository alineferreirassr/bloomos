import { describe, expect, it } from "vitest";
import {
  canTransitionPurchaseStatus,
  canEditPurchase,
  canEditPurchaseItems,
  canRemovePurchaseItem,
  canReceivePurchase,
  validateMoneyAmount,
  validatePurchaseItemQuantities,
  computeLineSubtotal,
  computePurchaseSubtotal,
  computePurchaseTotal,
  derivePurchaseReceiptStatus,
} from "@/core/workflows/purchaseWorkflow";

describe("canTransitionPurchaseStatus", () => {
  it("allows draft to move to submitted, cancelled, or archived", () => {
    expect(canTransitionPurchaseStatus("draft", "submitted")).toBe(true);
    expect(canTransitionPurchaseStatus("draft", "cancelled")).toBe(true);
    expect(canTransitionPurchaseStatus("draft", "archived")).toBe(true);
  });

  it("rejects transitioning to the same status", () => {
    expect(canTransitionPurchaseStatus("submitted", "submitted")).toBe(false);
  });

  it("rejects draft moving directly to a receipt-derived status", () => {
    expect(canTransitionPurchaseStatus("draft", "partially_received")).toBe(false);
    expect(canTransitionPurchaseStatus("draft", "fully_received")).toBe(false);
  });

  it("allows fully_received to move only to archived", () => {
    expect(canTransitionPurchaseStatus("fully_received", "archived")).toBe(true);
    expect(canTransitionPurchaseStatus("fully_received", "cancelled")).toBe(false);
    expect(canTransitionPurchaseStatus("fully_received", "submitted")).toBe(false);
  });

  it("allows cancelled to move only to archived", () => {
    expect(canTransitionPurchaseStatus("cancelled", "archived")).toBe(true);
    expect(canTransitionPurchaseStatus("cancelled", "submitted")).toBe(false);
  });

  it("allows archived to move only back to draft", () => {
    expect(canTransitionPurchaseStatus("archived", "draft")).toBe(true);
    expect(canTransitionPurchaseStatus("archived", "submitted")).toBe(false);
    expect(canTransitionPurchaseStatus("archived", "cancelled")).toBe(false);
  });
});

describe("canEditPurchase", () => {
  it("allows editing while draft or submitted", () => {
    expect(canEditPurchase("draft")).toBe(true);
    expect(canEditPurchase("submitted")).toBe(true);
  });

  it("rejects editing once partially/fully received, cancelled, or archived", () => {
    expect(canEditPurchase("partially_received")).toBe(false);
    expect(canEditPurchase("fully_received")).toBe(false);
    expect(canEditPurchase("cancelled")).toBe(false);
    expect(canEditPurchase("archived")).toBe(false);
  });
});

describe("canEditPurchaseItems / canRemovePurchaseItem", () => {
  it("allows item edits only while draft", () => {
    expect(canEditPurchaseItems("draft")).toBe(true);
    expect(canEditPurchaseItems("submitted")).toBe(false);
  });

  it("allows removal only while draft and nothing received", () => {
    expect(canRemovePurchaseItem("draft", 0)).toBe(true);
    expect(canRemovePurchaseItem("draft", 1)).toBe(false);
    expect(canRemovePurchaseItem("submitted", 0)).toBe(false);
  });
});

describe("canReceivePurchase", () => {
  it("allows receiving only while submitted or partially_received", () => {
    expect(canReceivePurchase("submitted")).toBe(true);
    expect(canReceivePurchase("partially_received")).toBe(true);
  });

  it("rejects receiving while draft, fully_received, cancelled, or archived", () => {
    expect(canReceivePurchase("draft")).toBe(false);
    expect(canReceivePurchase("fully_received")).toBe(false);
    expect(canReceivePurchase("cancelled")).toBe(false);
    expect(canReceivePurchase("archived")).toBe(false);
  });
});

describe("validateMoneyAmount", () => {
  it("accepts a non-negative whole number", () => {
    expect(validateMoneyAmount(0, "Tax")).toBeNull();
    expect(validateMoneyAmount(500, "Tax")).toBeNull();
  });

  it("rejects a negative amount", () => {
    expect(validateMoneyAmount(-1, "Tax")).not.toBeNull();
  });

  it("rejects a non-integer amount", () => {
    expect(validateMoneyAmount(1.5, "Tax")).not.toBeNull();
  });
});

describe("validatePurchaseItemQuantities", () => {
  it("accepts a valid ordered/received pair", () => {
    expect(validatePurchaseItemQuantities(10, 4)).toBeNull();
    expect(validatePurchaseItemQuantities(10, 10)).toBeNull();
    expect(validatePurchaseItemQuantities(10, 0)).toBeNull();
  });

  it("rejects a non-positive quantity_ordered", () => {
    expect(validatePurchaseItemQuantities(0, 0)).not.toBeNull();
    expect(validatePurchaseItemQuantities(-1, 0)).not.toBeNull();
  });

  it("rejects a negative quantity_received", () => {
    expect(validatePurchaseItemQuantities(10, -1)).not.toBeNull();
  });

  it("rejects quantity_received exceeding quantity_ordered (over-receipt)", () => {
    expect(validatePurchaseItemQuantities(10, 11)).not.toBeNull();
  });
});

describe("computeLineSubtotal / computePurchaseSubtotal / computePurchaseTotal", () => {
  it("computes a line subtotal as unit cost times quantity", () => {
    expect(computeLineSubtotal(250, 4)).toBe(1000);
  });

  it("sums line subtotals for the purchase subtotal", () => {
    expect(computePurchaseSubtotal([{ line_subtotal_minor: 1000 }, { line_subtotal_minor: 500 }])).toBe(1500);
  });

  it("computes total as subtotal + tax + shipping - discount", () => {
    expect(computePurchaseTotal(1000, 100, 200, 50)).toBe(1250);
  });

  it("can produce a negative total when discount exceeds the rest — callers are responsible for rejecting it", () => {
    expect(computePurchaseTotal(100, 0, 0, 200)).toBe(-100);
  });
});

describe("derivePurchaseReceiptStatus", () => {
  it("returns not_started for a purchase with no items", () => {
    expect(derivePurchaseReceiptStatus([])).toBe("not_started");
  });

  it("returns not_started when nothing has been received yet", () => {
    expect(derivePurchaseReceiptStatus([{ quantity_ordered: 10, quantity_received: 0 }])).toBe("not_started");
  });

  it("returns partially_received when some but not all quantity has arrived", () => {
    expect(
      derivePurchaseReceiptStatus([
        { quantity_ordered: 10, quantity_received: 4 },
        { quantity_ordered: 5, quantity_received: 0 },
      ]),
    ).toBe("partially_received");
  });

  it("returns fully_received once every unit across every item has arrived", () => {
    expect(
      derivePurchaseReceiptStatus([
        { quantity_ordered: 10, quantity_received: 10 },
        { quantity_ordered: 5, quantity_received: 5 },
      ]),
    ).toBe("fully_received");
  });
});
