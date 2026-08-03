import { describe, it, expect } from "vitest";
import { buildAdjustment, computeCreditsAndAdjustments } from "@/core/invoicePlatform/creditAdjustmentEngine";

describe("buildAdjustment", () => {
  it("builds an adjustment with a null sourceInvoiceId by default", () => {
    const adj = buildAdjustment({ kind: "credit", label: "Loyalty Credit", amount_minor: -500, notes: null });
    expect(adj.sourceInvoiceId).toBeNull();
  });

  it("carries a sourceInvoiceId for balance_carry_forward", () => {
    const adj = buildAdjustment({ kind: "balance_carry_forward", label: "Carried from prior invoice", amount_minor: 2000, notes: null, sourceInvoiceId: "invoice_prior" });
    expect(adj.sourceInvoiceId).toBe("invoice_prior");
  });
});

describe("computeCreditsAndAdjustments", () => {
  it("categorizes every named adjustment kind", () => {
    const adjustments = [
      buildAdjustment({ kind: "credit", label: "A", amount_minor: -100, notes: null }),
      buildAdjustment({ kind: "service_credit", label: "B", amount_minor: -200, notes: null }),
      buildAdjustment({ kind: "invoice_credit", label: "C", amount_minor: -300, notes: null }),
      buildAdjustment({ kind: "manual_adjustment", label: "D", amount_minor: -400, notes: null }),
      buildAdjustment({ kind: "refund_placeholder", label: "E", amount_minor: -500, notes: null }),
      buildAdjustment({ kind: "balance_carry_forward", label: "F", amount_minor: 1000, notes: null }),
    ];
    const result = computeCreditsAndAdjustments(adjustments);
    expect(result.credits).toHaveLength(1);
    expect(result.serviceCredits).toHaveLength(1);
    expect(result.invoiceCredits).toHaveLength(1);
    expect(result.manualAdjustments).toHaveLength(1);
    expect(result.refundPlaceholders).toHaveLength(1);
    expect(result.balanceCarryForwards).toHaveLength(1);
  });

  it("computes totalReductions_minor as a positive magnitude excluding carry-forward", () => {
    const adjustments = [buildAdjustment({ kind: "credit", label: "A", amount_minor: -100, notes: null }), buildAdjustment({ kind: "manual_adjustment", label: "B", amount_minor: -200, notes: null })];
    const result = computeCreditsAndAdjustments(adjustments);
    expect(result.totalReductions_minor).toBe(300);
  });

  it("computes totalCarryForward_minor as a positive magnitude", () => {
    const adjustments = [buildAdjustment({ kind: "balance_carry_forward", label: "A", amount_minor: 1500, notes: null })];
    const result = computeCreditsAndAdjustments(adjustments);
    expect(result.totalCarryForward_minor).toBe(1500);
  });

  it("computes netAdjustment_minor as carry-forward minus reductions", () => {
    const adjustments = [buildAdjustment({ kind: "credit", label: "A", amount_minor: -300, notes: null }), buildAdjustment({ kind: "balance_carry_forward", label: "B", amount_minor: 1000, notes: null })];
    const result = computeCreditsAndAdjustments(adjustments);
    expect(result.netAdjustment_minor).toBe(700);
  });

  it("returns all-zero for an empty list", () => {
    const result = computeCreditsAndAdjustments([]);
    expect(result.totalReductions_minor).toBe(0);
    expect(result.totalCarryForward_minor).toBe(0);
    expect(result.netAdjustment_minor).toBe(0);
  });
});
