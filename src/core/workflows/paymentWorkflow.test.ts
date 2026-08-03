import { describe, expect, it } from "vitest";
import {
  canTransitionPaymentStatus,
  getNextPaymentStatuses,
  isPaymentFinal,
  isPaymentRefundable,
  getPaymentNextRecommendedAction,
} from "@/core/workflows/paymentWorkflow";

describe("canTransitionPaymentStatus", () => {
  it("allows pending -> processing, succeeded, failed, cancelled", () => {
    for (const to of ["processing", "succeeded", "failed", "cancelled"] as const) {
      expect(canTransitionPaymentStatus("pending", to)).toBe(true);
    }
  });

  it("allows succeeded -> partially_refunded, refunded", () => {
    expect(canTransitionPaymentStatus("succeeded", "partially_refunded")).toBe(true);
    expect(canTransitionPaymentStatus("succeeded", "refunded")).toBe(true);
  });

  it("disallows succeeded -> failed (a succeeded payment can only move toward a refund)", () => {
    expect(canTransitionPaymentStatus("succeeded", "failed")).toBe(false);
  });

  it("allows partially_refunded -> refunded", () => {
    expect(canTransitionPaymentStatus("partially_refunded", "refunded")).toBe(true);
  });

  it("disallows any transition out of failed/refunded/cancelled", () => {
    expect(getNextPaymentStatuses("failed")).toEqual([]);
    expect(getNextPaymentStatuses("refunded")).toEqual([]);
    expect(getNextPaymentStatuses("cancelled")).toEqual([]);
  });

  it("disallows a status transitioning to itself", () => {
    expect(canTransitionPaymentStatus("pending", "pending")).toBe(false);
  });
});

describe("isPaymentFinal", () => {
  it("is true for failed, refunded, cancelled", () => {
    expect(isPaymentFinal("failed")).toBe(true);
    expect(isPaymentFinal("refunded")).toBe(true);
    expect(isPaymentFinal("cancelled")).toBe(true);
  });

  it("is false for succeeded and partially_refunded — both remain refundable", () => {
    expect(isPaymentFinal("succeeded")).toBe(false);
    expect(isPaymentFinal("partially_refunded")).toBe(false);
  });

  it("is false for pending/processing", () => {
    expect(isPaymentFinal("pending")).toBe(false);
    expect(isPaymentFinal("processing")).toBe(false);
  });
});

describe("isPaymentRefundable", () => {
  it("is true for succeeded and partially_refunded", () => {
    expect(isPaymentRefundable("succeeded")).toBe(true);
    expect(isPaymentRefundable("partially_refunded")).toBe(true);
  });

  it("is false for every other status", () => {
    for (const status of ["pending", "processing", "failed", "refunded", "cancelled"] as const) {
      expect(isPaymentRefundable(status)).toBe(false);
    }
  });
});

describe("getPaymentNextRecommendedAction", () => {
  it("recommends confirming a pending payment", () => {
    expect(getPaymentNextRecommendedAction({ status: "pending" })).toMatch(/confirm/i);
  });

  it("recommends resolving a processing payment", () => {
    expect(getPaymentNextRecommendedAction({ status: "processing" })).toMatch(/succeeded once confirmed/i);
  });

  it("flags a failed payment for follow-up", () => {
    expect(getPaymentNextRecommendedAction({ status: "failed" })).toMatch(/failed/i);
  });

  it("returns null for a settled payment (succeeded/partially_refunded/refunded/cancelled)", () => {
    for (const status of ["succeeded", "partially_refunded", "refunded", "cancelled"] as const) {
      expect(getPaymentNextRecommendedAction({ status })).toBeNull();
    }
  });
});
