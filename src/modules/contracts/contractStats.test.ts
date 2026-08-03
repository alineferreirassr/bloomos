import { describe, expect, it } from "vitest";
import { computeContractStats } from "@/modules/contracts/contractStats";
import { makeContract } from "@/modules/contracts/testUtils";

describe("computeContractStats", () => {
  it("returns all-zero stats for an empty list", () => {
    expect(computeContractStats([])).toEqual({
      total: 0,
      draft: 0,
      sent: 0,
      viewed: 0,
      signed: 0,
      pendingSignature: 0,
      expired: 0,
      cancelled: 0,
      contractValue: 0,
      depositPending: 0,
      completedValue: 0,
    });
  });

  it("counts each status independently", () => {
    const contracts = [
      makeContract({ id: "c1", status: "draft" }),
      makeContract({ id: "c2", status: "sent" }),
      makeContract({ id: "c3", status: "viewed" }),
      makeContract({ id: "c4", status: "signed" }),
      makeContract({ id: "c5", status: "expired" }),
      makeContract({ id: "c6", status: "cancelled" }),
    ];
    const stats = computeContractStats(contracts);
    expect(stats.total).toBe(6);
    expect(stats.draft).toBe(1);
    expect(stats.sent).toBe(1);
    expect(stats.viewed).toBe(1);
    expect(stats.signed).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.cancelled).toBe(1);
  });

  it("counts pendingSignature for sent, viewed, and partially_signed contracts", () => {
    const contracts = [
      makeContract({ id: "c1", status: "sent", signature_status: "sent" }),
      makeContract({ id: "c2", status: "viewed", signature_status: "viewed" }),
      makeContract({ id: "c3", status: "signed", signature_status: "partially_signed" }),
      makeContract({ id: "c4", status: "draft", signature_status: "unsigned" }),
    ];
    expect(computeContractStats(contracts).pendingSignature).toBe(3);
  });

  it("sums total_value across the active pipeline for contractValue, excluding cancelled/declined/expired/archived", () => {
    const contracts = [
      makeContract({ id: "c1", status: "draft", total_value: 1000 }),
      makeContract({ id: "c2", status: "signed", total_value: 2000 }),
      makeContract({ id: "c3", status: "cancelled", total_value: 5000 }),
      makeContract({ id: "c4", status: "declined", total_value: 5000 }),
      makeContract({ id: "c5", status: "expired", total_value: 5000 }),
      makeContract({ id: "c6", status: "archived", total_value: 5000 }),
      makeContract({ id: "c7", status: "completed", total_value: 500 }),
    ];
    expect(computeContractStats(contracts).contractValue).toBe(1000 + 2000 + 500);
  });

  it("treats a null total_value as 0 when summing", () => {
    const contracts = [makeContract({ id: "c1", status: "draft", total_value: null })];
    expect(computeContractStats(contracts).contractValue).toBe(0);
  });

  it("sums deposit_amount only for active-pipeline contracts with deposit_required", () => {
    const contracts = [
      makeContract({ id: "c1", status: "draft", deposit_required: true, deposit_amount: 300 }),
      makeContract({ id: "c2", status: "sent", deposit_required: false, deposit_amount: null }),
      makeContract({ id: "c3", status: "cancelled", deposit_required: true, deposit_amount: 900 }),
    ];
    expect(computeContractStats(contracts).depositPending).toBe(300);
  });

  it("sums total_value only across completed contracts for completedValue", () => {
    const contracts = [
      makeContract({ id: "c1", status: "completed", total_value: 1200 }),
      makeContract({ id: "c2", status: "completed", total_value: 300 }),
      makeContract({ id: "c3", status: "signed", total_value: 900 }),
    ];
    expect(computeContractStats(contracts).completedValue).toBe(1500);
  });
});
