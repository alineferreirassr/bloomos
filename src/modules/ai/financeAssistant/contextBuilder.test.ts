import { describe, expect, it } from "vitest";
import { buildFinanceAssistantContext } from "@/modules/ai/financeAssistant/contextBuilder";
import type { FinanceAssistantMaterials } from "@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server";
import { makeInvoice, makePayment, makeExpense } from "@/modules/finance/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";
import { makeEvent } from "@/modules/events/testUtils";
import type { ProposalDraft } from "@/types/proposal";
import type { AuditLogEntry } from "@/core/audit/types";

function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: "proposal_test",
    workspace_id: "ws_test",
    event_id: "event_test",
    client_id: "client_test",
    status: "draft",
    version: 1,
    parent_proposal_id: null,
    executive_summary: "",
    event_overview: "",
    services_included: [],
    timeline_summary: "",
    pricing_summary: { subtotal_minor: 500000, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "mock-1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: "2026-07-20T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function makeActivityEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: "audit_test",
    workspace_id: "ws_test",
    actor: "member_1",
    action: "invoice_updated",
    owner_type: "invoice",
    owner_id: "invoice_test",
    before: null,
    after: null,
    occurred_at: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function materials(overrides: Partial<FinanceAssistantMaterials> = {}): FinanceAssistantMaterials {
  return {
    contracts: [],
    invoices: [],
    payments: [],
    expenses: [],
    events: [],
    proposals: [],
    dailyBriefExecutions: [],
    activity: [],
    unavailableCategories: [],
    ...overrides,
  };
}

const NOW = new Date("2026-07-26T12:00:00.000Z");

describe("buildFinanceAssistantContext — Revenue/Cash Flow (reused formulas)", () => {
  it("computes revenue and collected this month from real Invoices/Payments", () => {
    const context = buildFinanceAssistantContext(
      materials({
        invoices: [makeInvoice({ id: "i1", issue_date: "2026-07-10", total_minor: 10000, status: "sent" })],
        payments: [makePayment({ id: "p1", status: "succeeded", payment_type: "deposit", amount_minor: 5000, transaction_date: "2026-07-15" })],
      }),
      NOW,
    );
    expect(context.revenueThisMonthMinor).toBe(10000);
    expect(context.collectedThisMonthMinor).toBe(5000);
  });

  it("computes net cash position from collected minus this month's Expenses, giving the Expenses fetch real effect", () => {
    const context = buildFinanceAssistantContext(
      materials({
        payments: [makePayment({ id: "p1", status: "succeeded", amount_minor: 10000, transaction_date: "2026-07-10" })],
        expenses: [makeExpense({ id: "e1", amount_minor: 4000, transaction_date: "2026-07-12", status: "paid" })],
      }),
      NOW,
    );
    expect(context.expensesThisMonthMinor).toBe(4000);
    expect(context.netCashPositionMinor).toBe(6000);
  });

  it("computes all-time totals across every non-voided Invoice and every counting Payment", () => {
    const context = buildFinanceAssistantContext(
      materials({
        invoices: [makeInvoice({ id: "i1", total_minor: 10000, status: "sent" }), makeInvoice({ id: "i2", total_minor: 5000, status: "voided" })],
        payments: [makePayment({ id: "p1", status: "succeeded", amount_minor: 8000 })],
      }),
      NOW,
    );
    expect(context.totalInvoicedAllTimeMinor).toBe(10000);
    expect(context.totalCollectedAllTimeMinor).toBe(8000);
  });
});

describe("buildFinanceAssistantContext — Outstanding/Payment Delays/Upcoming Revenue", () => {
  it("surfaces outstanding invoices with a positive balance, excluding voided/archived", () => {
    const context = buildFinanceAssistantContext(
      materials({
        invoices: [
          makeInvoice({ id: "i1", balance_minor: 5000, status: "sent" }),
          makeInvoice({ id: "i2", balance_minor: 3000, status: "voided" }),
          makeInvoice({ id: "i3", balance_minor: 0, status: "paid" }),
        ],
      }),
      NOW,
    );
    expect(context.outstandingInvoices.map((i) => i.invoiceId)).toEqual(["i1"]);
  });

  it("surfaces payment delays for status: overdue invoices only", () => {
    const context = buildFinanceAssistantContext(
      materials({
        invoices: [makeInvoice({ id: "i1", status: "overdue", balance_minor: 5000 }), makeInvoice({ id: "i2", status: "sent", balance_minor: 5000 })],
      }),
      NOW,
    );
    expect(context.paymentDelays.map((i) => i.invoiceId)).toEqual(["i1"]);
  });

  it("surfaces upcoming revenue due within 30 days, not yet overdue", () => {
    const context = buildFinanceAssistantContext(
      materials({
        invoices: [
          makeInvoice({ id: "i1", status: "sent", balance_minor: 5000, due_date: "2026-08-05" }),
          makeInvoice({ id: "i2", status: "sent", balance_minor: 5000, due_date: "2026-09-30" }),
          makeInvoice({ id: "i3", status: "overdue", balance_minor: 5000, due_date: "2026-07-01" }),
        ],
      }),
      NOW,
    );
    expect(context.upcomingRevenue.map((i) => i.invoiceId)).toEqual(["i1"]);
  });
});

describe("buildFinanceAssistantContext — Refunds", () => {
  it("surfaces only payment_type: refund payments, newest first", () => {
    const context = buildFinanceAssistantContext(
      materials({
        payments: [
          makePayment({ id: "p1", payment_type: "refund", status: "succeeded", transaction_date: "2026-07-01" }),
          makePayment({ id: "p2", payment_type: "deposit", status: "succeeded", transaction_date: "2026-07-10" }),
          makePayment({ id: "p3", payment_type: "refund", status: "succeeded", transaction_date: "2026-07-15" }),
        ],
      }),
      NOW,
    );
    expect(context.refunds.map((p) => p.paymentId)).toEqual(["p3", "p1"]);
  });
});

describe("buildFinanceAssistantContext — Contract Value", () => {
  it("splits contract value into signed vs unsigned, excluding inactive statuses", () => {
    const context = buildFinanceAssistantContext(
      materials({
        contracts: [
          makeContract({ id: "c1", total_value: 1000, signature_status: "signed", status: "signed" }),
          makeContract({ id: "c2", total_value: 500, signature_status: "unsigned", status: "sent" }),
          makeContract({ id: "c3", total_value: 2000, signature_status: "unsigned", status: "cancelled" }),
        ],
      }),
      NOW,
    );
    expect(context.contractValueSignedMinor).toBe(100000);
    expect(context.contractValueUnsignedMinor).toBe(50000);
    expect(context.contractValueTotalMinor).toBe(150000);
    expect(context.unsignedContracts.map((c) => c.contractId)).toEqual(["c2"]);
  });
});

describe("buildFinanceAssistantContext — Financial Risks", () => {
  it("flags an invoice overdue beyond the severe threshold (14 days)", () => {
    const context = buildFinanceAssistantContext(
      materials({ invoices: [makeInvoice({ id: "i1", invoice_number: "INV-1", status: "overdue", balance_minor: 5000, due_date: "2026-07-01" })] }),
      NOW,
    );
    expect(context.financialRisks).toHaveLength(1);
    expect(context.financialRisks[0].riskId).toBe("invoice:i1");
    expect(context.financialRisks[0].targetType).toBe("invoice");
  });

  it("never flags an invoice only mildly overdue", () => {
    const context = buildFinanceAssistantContext(
      materials({ invoices: [makeInvoice({ id: "i1", status: "overdue", balance_minor: 5000, due_date: "2026-07-24" })] }),
      NOW,
    );
    expect(context.financialRisks).toHaveLength(0);
  });

  it("flags an unsigned contract whose Event is imminent or already past", () => {
    const context = buildFinanceAssistantContext(
      materials({ contracts: [makeContract({ id: "c1", contract_number: "C-1", signature_status: "unsigned", effective_date: "2026-07-28" })] }),
      NOW,
    );
    expect(context.financialRisks.map((r) => r.riskId)).toContain("contract:c1");
  });

  it("never flags an unsigned contract whose Event is far in the future", () => {
    const context = buildFinanceAssistantContext(
      materials({ contracts: [makeContract({ id: "c1", signature_status: "unsigned", effective_date: "2027-01-01" })] }),
      NOW,
    );
    expect(context.financialRisks).toHaveLength(0);
  });
});

describe("buildFinanceAssistantContext — Proposal Values, Upcoming Events, Activity", () => {
  it("sorts proposal values newest first", () => {
    const context = buildFinanceAssistantContext(
      materials({
        proposals: [makeProposal({ id: "p1", generated_at: "2026-07-01T00:00:00.000Z" }), makeProposal({ id: "p2", generated_at: "2026-07-20T00:00:00.000Z" })],
      }),
      NOW,
    );
    expect(context.proposalValues.map((p) => p.proposalId)).toEqual(["p2", "p1"]);
  });

  it("surfaces only future Events, sorted soonest first", () => {
    const context = buildFinanceAssistantContext(
      materials({
        events: [makeEvent({ id: "e1", event_date: "2026-08-10" }), makeEvent({ id: "e2", event_date: "2026-08-01" }), makeEvent({ id: "e3", event_date: "2026-07-01" })],
      }),
      NOW,
    );
    expect(context.upcomingEvents.map((e) => e.eventId)).toEqual(["e2", "e1"]);
  });

  it("never exposes before/after on activity entries — safe projection only", () => {
    const context = buildFinanceAssistantContext(
      materials({ activity: [makeActivityEntry({ before: { total_minor: 500 }, after: { total_minor: 900 } })] }),
      NOW,
    );
    expect(context.recentActivity[0]).toEqual({ action: "invoice_updated", ownerType: "invoice", occurredAt: "2026-07-20T00:00:00.000Z" });
  });
});

describe("buildFinanceAssistantContext — unavailableCategories and enrichment placeholders", () => {
  it("passes unavailableCategories straight through from materials", () => {
    const context = buildFinanceAssistantContext(materials({ unavailableCategories: ["payments", "contracts"] }), NOW);
    expect(context.unavailableCategories).toEqual(["payments", "contracts"]);
  });

  it("starts with empty recentMemories/crmRecommendations — populated later by composeContext, never fetched here", () => {
    const context = buildFinanceAssistantContext(materials(), NOW);
    expect(context.recentMemories).toEqual([]);
    expect(context.crmRecommendations).toEqual([]);
  });
});
