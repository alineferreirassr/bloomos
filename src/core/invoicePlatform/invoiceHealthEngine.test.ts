import { describe, it, expect } from "vitest";
import { computeInvoiceHealth, type ComputeInvoiceHealthInput } from "@/core/invoicePlatform/invoiceHealthEngine";
import { makeVersion, makeSnapshot, makePricing, makeInstallment } from "@/core/invoicePlatform/testFixtures";

function input(overrides: Partial<ComputeInvoiceHealthInput> = {}): ComputeInvoiceHealthInput {
  return {
    builderState: null,
    currentVersion: makeVersion(),
    hasClient: true,
    hasLinkedProposal: true,
    hasLinkedContract: true,
    invoiceIssueDate: new Date().toISOString(),
    invoiceDueDate: new Date().toISOString(),
    evaluatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeInvoiceHealth", () => {
  it("marks every category not applicable when no document has been built yet", () => {
    const result = computeInvoiceHealth(input({ currentVersion: null }));
    const completeness = result.categories.find((c) => c.category === "completeness");
    expect(completeness?.notApplicableReason).not.toBeNull();
  });

  it("scores completeness perfectly for a fully-filled snapshot", () => {
    const result = computeInvoiceHealth(input());
    const completeness = result.categories.find((c) => c.category === "completeness");
    expect(completeness?.score).toBe(100);
  });

  it("flags pricing_health when the grand total is zero", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 0 }) }) });
    const result = computeInvoiceHealth(input({ currentVersion: version }));
    const pricing = result.categories.find((c) => c.category === "pricing_health");
    expect(pricing?.score).toBeLessThan(100);
  });

  it("marks schedule_health not applicable when no payment schedule exists", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ paymentSchedule: [] }) });
    const result = computeInvoiceHealth(input({ currentVersion: version }));
    const schedule = result.categories.find((c) => c.category === "schedule_health");
    expect(schedule?.notApplicableReason).not.toBeNull();
  });

  it("scores schedule_health lower when the schedule doesn't sum to the grand total", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ pricing: makePricing({ grandTotal_minor: 10000 }), paymentSchedule: [makeInstallment({ amount_minor: 5000 })] }) });
    const result = computeInvoiceHealth(input({ currentVersion: version }));
    const schedule = result.categories.find((c) => c.category === "schedule_health");
    expect(schedule?.score).toBeLessThan(100);
  });

  it("flags required_fields when the real invoice's issue/due dates are missing", () => {
    const result = computeInvoiceHealth(input({ invoiceIssueDate: null, invoiceDueDate: null }));
    const required = result.categories.find((c) => c.category === "required_fields");
    expect(required?.score).toBe(0);
  });

  it("scores client_link/proposal_link/contract_link as binary", () => {
    const result = computeInvoiceHealth(input({ hasClient: false, hasLinkedProposal: false, hasLinkedContract: false }));
    expect(result.categories.find((c) => c.category === "client_link")?.score).toBe(0);
    expect(result.categories.find((c) => c.category === "proposal_link")?.score).toBe(0);
    expect(result.categories.find((c) => c.category === "contract_link")?.score).toBe(0);
  });

  it("computes overall score as the average of non-null category scores", () => {
    const result = computeInvoiceHealth(input());
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("stamps the caller-provided evaluatedAt", () => {
    const result = computeInvoiceHealth(input({ evaluatedAt: "2026-07-31T00:00:00.000Z" }));
    expect(result.evaluatedAt).toBe("2026-07-31T00:00:00.000Z");
  });

  it("never throws for an empty line item list", () => {
    const version = makeVersion({ snapshot: makeSnapshot({ lineItems: [] }) });
    expect(() => computeInvoiceHealth(input({ currentVersion: version }))).not.toThrow();
  });
});
