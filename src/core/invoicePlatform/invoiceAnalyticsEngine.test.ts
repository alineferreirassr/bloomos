import { describe, it, expect } from "vitest";
import { computeInvoiceAnalytics, type InvoiceAnalyticsInput } from "@/core/invoicePlatform/invoiceAnalyticsEngine";
import { makeBuilderState, makeVersion, makeSnapshot, makePricing, makeInstallment, makeAdjustment } from "@/core/invoicePlatform/testFixtures";

describe("computeInvoiceAnalytics", () => {
  it("returns all-zero analytics for an empty input list", () => {
    const result = computeInvoiceAnalytics([], "2026-07-31T00:00:00.000Z");
    expect(result.totalInvoices).toBe(0);
    expect(result.averageInvoice_minor).toBe(0);
    expect(result.outstandingBalance_minor).toBe(0);
  });

  it("counts invoices by builder status", () => {
    const inputs: InvoiceAnalyticsInput[] = [
      { builderState: makeBuilderState({ status: "draft" }) },
      { builderState: makeBuilderState({ status: "review" }) },
      { builderState: makeBuilderState({ status: "published" }) },
      { builderState: makeBuilderState({ status: "archived" }) },
      { builderState: null },
    ];
    const result = computeInvoiceAnalytics(inputs, "2026-07-31T00:00:00.000Z");
    expect(result.totalInvoices).toBe(5);
    expect(result.draftCount).toBe(1);
    expect(result.reviewCount).toBe(1);
    expect(result.publishedCount).toBe(1);
    expect(result.archivedCount).toBe(1);
  });

  it("averages grand total, deposit, and remaining balance across built invoices", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 10000, depositDue_minor: 2000, remainingBalance_minor: 8000 }) }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 20000, depositDue_minor: 4000, remainingBalance_minor: 16000 }) }) });
    const stateA = makeBuilderState({ current_version_id: v1.id, versions: [v1] });
    const stateB = makeBuilderState({ current_version_id: v2.id, versions: [v2] });
    const result = computeInvoiceAnalytics([{ builderState: stateA }, { builderState: stateB }], "2026-07-31T00:00:00.000Z");
    expect(result.averageInvoice_minor).toBe(15000);
    expect(result.averageDeposit_minor).toBe(3000);
    expect(result.averageBalance_minor).toBe(12000);
  });

  it("sums outstanding balance across every invoice rather than averaging it", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ outstandingBalance_minor: 5000 }) }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ outstandingBalance_minor: 7000 }) }) });
    const stateA = makeBuilderState({ current_version_id: v1.id, versions: [v1] });
    const stateB = makeBuilderState({ current_version_id: v2.id, versions: [v2] });
    const result = computeInvoiceAnalytics([{ builderState: stateA }, { builderState: stateB }], "2026-07-31T00:00:00.000Z");
    expect(result.outstandingBalance_minor).toBe(12000);
  });

  it("averages installment counts", () => {
    const v1 = makeVersion({ snapshot: makeSnapshot({ paymentSchedule: [makeInstallment(), makeInstallment()] }) });
    const v2 = makeVersion({ snapshot: makeSnapshot({ paymentSchedule: [] }) });
    const stateA = makeBuilderState({ current_version_id: v1.id, versions: [v1] });
    const stateB = makeBuilderState({ current_version_id: v2.id, versions: [v2] });
    const result = computeInvoiceAnalytics([{ builderState: stateA }, { builderState: stateB }], "2026-07-31T00:00:00.000Z");
    expect(result.averageInstallments).toBe(1);
  });

  it("averages credit total only across credit/service_credit/invoice_credit kinds, excluding manual adjustments", () => {
    const v1 = makeVersion({
      snapshot: makeSnapshot({
        adjustments: [makeAdjustment({ kind: "credit", amount_minor: -1000 }), makeAdjustment({ kind: "manual_adjustment", amount_minor: -9000 })],
      }),
    });
    const stateA = makeBuilderState({ current_version_id: v1.id, versions: [v1] });
    const result = computeInvoiceAnalytics([{ builderState: stateA }], "2026-07-31T00:00:00.000Z");
    expect(result.averageCredit_minor).toBe(1000);
  });

  it("skips builder states with no current version when averaging amounts", () => {
    const noVersionState = makeBuilderState({ current_version_id: "nonexistent", versions: [] });
    const result = computeInvoiceAnalytics([{ builderState: noVersionState }], "2026-07-31T00:00:00.000Z");
    expect(result.averageInvoice_minor).toBe(0);
  });

  it("stamps the caller-provided evaluatedAt", () => {
    const result = computeInvoiceAnalytics([], "2026-07-31T00:00:00.000Z");
    expect(result.evaluatedAt).toBe("2026-07-31T00:00:00.000Z");
  });
});
