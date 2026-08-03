import { describe, it, expect } from "vitest";
import { invoiceHealthToRecommendations, type InvoiceExecutiveContext } from "@/core/invoicePlatform/invoiceExecutiveIntegration";
import { computeInvoiceHealth } from "@/core/invoicePlatform/invoiceHealthEngine";
import { makeInvoice, makeVersion, makePricing } from "@/core/invoicePlatform/testFixtures";

const NOW = "2026-07-31T00:00:00.000Z";

function baseHealth() {
  return computeInvoiceHealth({
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    hasLinkedProposal: true,
    hasLinkedContract: true,
    invoiceIssueDate: NOW,
    invoiceDueDate: NOW,
    evaluatedAt: NOW,
  });
}

function context(overrides: Partial<InvoiceExecutiveContext> = {}): InvoiceExecutiveContext {
  return {
    invoice: makeInvoice(),
    readiness: { state: "ready", reasons: [], canPublish: true },
    health: baseHealth(),
    documentStatus: "draft",
    pricing: makePricing(),
    ...overrides,
  };
}

describe("invoiceHealthToRecommendations", () => {
  it("recommends invoice_platform.ready when the document can publish", () => {
    const recs = invoiceHealthToRecommendations(context());
    expect(recs.some((r) => r.ruleId === "invoice_platform.ready")).toBe(true);
  });

  it("recommends missing_contract for a missing_contract readiness state", () => {
    const recs = invoiceHealthToRecommendations(context({ readiness: { state: "missing_contract", reasons: ["No contract."], canPublish: false } }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.missing_contract")).toBe(true);
  });

  it("recommends missing_proposal for a missing_proposal readiness state", () => {
    const recs = invoiceHealthToRecommendations(context({ readiness: { state: "missing_proposal", reasons: ["No proposal."], canPublish: false } }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.missing_proposal")).toBe(true);
  });

  it("recommends needs_review for a needs_review readiness state", () => {
    const recs = invoiceHealthToRecommendations(context({ readiness: { state: "needs_review", reasons: ["Health is low."], canPublish: false } }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.needs_review")).toBe(true);
  });

  it("recommends outstanding_balance for a published invoice with a positive outstanding balance", () => {
    const recs = invoiceHealthToRecommendations(context({ documentStatus: "published", pricing: makePricing({ outstandingBalance_minor: 5000 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.outstanding_balance")).toBe(true);
  });

  it("does not recommend outstanding_balance for a draft invoice even with a positive balance", () => {
    const recs = invoiceHealthToRecommendations(context({ documentStatus: "draft", pricing: makePricing({ outstandingBalance_minor: 5000 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.outstanding_balance")).toBe(false);
  });

  it("recommends large_discount when the discount is at least 20% of the line items subtotal", () => {
    const recs = invoiceHealthToRecommendations(context({ pricing: makePricing({ lineItemsSubtotal_minor: 10000, discountsTotal_minor: -3000 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.large_discount")).toBe(true);
  });

  it("does not recommend large_discount for a small discount", () => {
    const recs = invoiceHealthToRecommendations(context({ pricing: makePricing({ lineItemsSubtotal_minor: 10000, discountsTotal_minor: -500 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.large_discount")).toBe(false);
  });

  it("recommends high_value_invoice for a grand total at or above the threshold", () => {
    const recs = invoiceHealthToRecommendations(context({ pricing: makePricing({ grandTotal_minor: 50000 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.high_value_invoice")).toBe(true);
  });

  it("does not recommend high_value_invoice for a low grand total", () => {
    const recs = invoiceHealthToRecommendations(context({ pricing: makePricing({ grandTotal_minor: 1000 }) }));
    expect(recs.some((r) => r.ruleId === "invoice_platform.high_value_invoice")).toBe(false);
  });

  it("attaches recommendations to the invoice's own node", () => {
    const invoice = makeInvoice();
    const recs = invoiceHealthToRecommendations(context({ invoice }));
    expect(recs[0].node).toEqual({ nodeType: "invoice", nodeId: invoice.id });
  });

  it("never throws when pricing is null", () => {
    expect(() => invoiceHealthToRecommendations(context({ pricing: null }))).not.toThrow();
  });
});
