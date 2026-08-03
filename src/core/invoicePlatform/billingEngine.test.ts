import { describe, it, expect } from "vitest";
import { computeInvoicePricing } from "@/core/invoicePlatform/billingEngine";
import { makeLineItem, makeAdjustment, makeInstallment } from "@/core/invoicePlatform/testFixtures";

describe("computeInvoicePricing", () => {
  it("computes a simple single-line-item invoice with no discounts/adjustments", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 65000 })],
      adjustments: [],
      paymentSchedule: [makeInstallment({ amount_minor: 65000 })],
      paidToDate_minor: 0,
    });
    expect(result.grandTotal_minor).toBe(65000);
    expect(result.outstandingBalance_minor).toBe(65000);
  });

  it("subtracts discount line items from the subtotal", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ kind: "service", amount_minor: 10000 }), makeLineItem({ kind: "discount", amount_minor: -1000 })],
      adjustments: [],
      paymentSchedule: [],
      paidToDate_minor: 0,
    });
    expect(result.subtotal_minor).toBe(9000);
    expect(result.discountsTotal_minor).toBe(1000);
  });

  it("adds tax placeholder line items on top of the subtotal", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ kind: "service", amount_minor: 10000 }), makeLineItem({ kind: "tax_placeholder", amount_minor: -800 })],
      adjustments: [],
      paymentSchedule: [],
      paidToDate_minor: 0,
    });
    expect(result.grandTotal_minor).toBe(10800);
  });

  it("nets adjustments into the grand total — credits reduce, carry-forward adds", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 10000 })],
      adjustments: [makeAdjustment({ kind: "credit", amount_minor: -1000 }), makeAdjustment({ kind: "balance_carry_forward", amount_minor: 500 })],
      paymentSchedule: [],
      paidToDate_minor: 0,
    });
    expect(result.grandTotal_minor).toBe(9500);
  });

  it("never returns a negative grand total", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 1000 })],
      adjustments: [makeAdjustment({ kind: "credit", amount_minor: -5000 })],
      paymentSchedule: [],
      paidToDate_minor: 0,
    });
    expect(result.grandTotal_minor).toBe(0);
  });

  it("reads depositDue_minor from a deposit-kind installment in the schedule", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 10000 })],
      adjustments: [],
      paymentSchedule: [makeInstallment({ kind: "deposit", amount_minor: 3000 }), makeInstallment({ kind: "final_payment", amount_minor: 7000 })],
      paidToDate_minor: 0,
    });
    expect(result.depositDue_minor).toBe(3000);
    expect(result.remainingBalance_minor).toBe(7000);
  });

  it("reuses the real paid_minor for outstandingBalance_minor, never recomputing it", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 10000 })],
      adjustments: [],
      paymentSchedule: [],
      paidToDate_minor: 4000,
    });
    expect(result.paidToDate_minor).toBe(4000);
    expect(result.outstandingBalance_minor).toBe(6000);
  });

  it("never returns a negative outstanding balance when overpaid", () => {
    const result = computeInvoicePricing({
      currency: "USD",
      lineItems: [makeLineItem({ amount_minor: 5000 })],
      adjustments: [],
      paymentSchedule: [],
      paidToDate_minor: 6000,
    });
    expect(result.outstandingBalance_minor).toBe(0);
  });
});
