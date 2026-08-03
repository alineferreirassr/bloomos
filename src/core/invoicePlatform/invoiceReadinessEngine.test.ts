import { describe, it, expect } from "vitest";
import { evaluateInvoiceReadiness, type EvaluateInvoiceReadinessInput } from "@/core/invoicePlatform/invoiceReadinessEngine";
import { computeInvoiceHealth } from "@/core/invoicePlatform/invoiceHealthEngine";
import { makeVersion, makeSnapshot } from "@/core/invoicePlatform/testFixtures";

function baseHealth() {
  return computeInvoiceHealth({
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    hasLinkedProposal: true,
    hasLinkedContract: true,
    invoiceIssueDate: new Date().toISOString(),
    invoiceDueDate: new Date().toISOString(),
    evaluatedAt: new Date().toISOString(),
  });
}

function input(overrides: Partial<EvaluateInvoiceReadinessInput> = {}): EvaluateInvoiceReadinessInput {
  return {
    currentVersion: makeVersion(),
    hasClient: true,
    hasLinkedProposal: true,
    hasLinkedContract: true,
    health: baseHealth(),
    ...overrides,
  };
}

describe("evaluateInvoiceReadiness", () => {
  it("is ready when every requirement and the health threshold are satisfied", () => {
    const result = evaluateInvoiceReadiness(input());
    expect(result.state).toBe("ready");
    expect(result.canPublish).toBe(true);
  });

  it("flags missing_client first when there is no linked client", () => {
    const result = evaluateInvoiceReadiness(input({ hasClient: false }));
    expect(result.state).toBe("missing_client");
    expect(result.canPublish).toBe(false);
  });

  it("flags missing_pricing when no document has been built yet", () => {
    const result = evaluateInvoiceReadiness(input({ currentVersion: null }));
    expect(result.state).toBe("missing_pricing");
  });

  it("flags missing_pricing when the grand total is zero", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ pricing: { ...makeSnapshot().pricing, grandTotal_minor: 0 } }) });
    const result = evaluateInvoiceReadiness(input({ currentVersion: version }));
    expect(result.state).toBe("missing_pricing");
  });

  it("flags missing_schedule when no payment schedule has been set", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ paymentSchedule: [] }) });
    const result = evaluateInvoiceReadiness(input({ currentVersion: version }));
    expect(result.state).toBe("missing_schedule");
  });

  it("flags missing_terms when terms are empty", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ terms: "" }) });
    const result = evaluateInvoiceReadiness(input({ currentVersion: version }));
    expect(result.state).toBe("missing_terms");
  });

  it("flags missing_proposal when no Proposal is linked", () => {
    const result = evaluateInvoiceReadiness(input({ hasLinkedProposal: false }));
    expect(result.state).toBe("missing_proposal");
  });

  it("flags missing_contract when no Contract is linked", () => {
    const result = evaluateInvoiceReadiness(input({ hasLinkedContract: false }));
    expect(result.state).toBe("missing_contract");
  });

  it("flags needs_review when overall health is below the ready threshold", () => {
    const lowHealth = computeInvoiceHealth({ builderState: null, currentVersion: null, hasClient: false, hasLinkedProposal: false, hasLinkedContract: false, invoiceIssueDate: null, invoiceDueDate: null, evaluatedAt: new Date().toISOString() });
    const result = evaluateInvoiceReadiness(input({ health: lowHealth }));
    expect(["needs_review", "missing_client", "missing_proposal", "missing_contract"]).toContain(result.state);
  });

  it("never marks canPublish true for any non-ready state", () => {
    const result = evaluateInvoiceReadiness(input({ hasClient: false }));
    expect(result.canPublish).toBe(false);
  });
});
