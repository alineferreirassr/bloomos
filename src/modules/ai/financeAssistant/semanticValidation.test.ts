import { describe, expect, it } from "vitest";
import { validateFinanceAssistantSemantics } from "@/modules/ai/financeAssistant/semanticValidation";
import type { FinanceAssistantContext, FinanceAssistantModelOutput } from "@/modules/ai/financeAssistant/types";

function makeContext(overrides: Partial<FinanceAssistantContext> = {}): FinanceAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    currency: "USD",
    revenueThisMonthMinor: 0,
    collectedThisMonthMinor: 0,
    totalInvoicedAllTimeMinor: 0,
    totalCollectedAllTimeMinor: 0,
    outstandingReceivablesMinor: 0,
    overdueReceivablesMinor: 0,
    refundsThisMonthMinor: 0,
    depositsPendingMinor: 0,
    expensesThisMonthMinor: 0,
    netCashPositionMinor: 0,
    outstandingInvoices: [{ invoiceId: "i1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, status: "sent", balanceMinor: 5000, totalMinor: 5000, currency: "USD", dueDate: null }],
    paymentDelays: [{ invoiceId: "i2", invoiceNumber: "INV-2", clientId: "c1", eventId: null, status: "overdue", balanceMinor: 5000, totalMinor: 5000, currency: "USD", dueDate: "2026-07-01" }],
    upcomingRevenue: [],
    refunds: [],
    contractValueTotalMinor: 0,
    contractValueSignedMinor: 0,
    contractValueUnsignedMinor: 0,
    unsignedContracts: [{ contractId: "ct1", contractNumber: "C-1", clientId: "c1", eventId: null, status: "sent", signatureStatus: "unsigned", totalValueMinor: 100000, currency: "USD", effectiveDate: null }],
    proposalValues: [],
    upcomingEvents: [{ eventId: "e1", title: "Test Event", eventDate: "2026-08-01", clientId: "c1" }],
    financialRisks: [{ riskId: "invoice:i2", targetType: "invoice", targetId: "i2", label: "Invoice INV-2 severely overdue", reasons: ["x"] }],
    recentDailyBriefs: [],
    recentActivity: [],
    crmRecommendations: [],
    recentMemories: [],
    unavailableCategories: [],
    ...overrides,
  };
}

function makeOutput(overrides: Partial<FinanceAssistantModelOutput> = {}): FinanceAssistantModelOutput {
  return {
    executiveSummary: "Summary.",
    revenueOverviewSummary: "Overview.",
    cashFlowSummary: "Cash flow.",
    financialRiskExplanations: [],
    revenueOpportunities: [],
    recommendations: [],
    ...overrides,
  };
}

describe("validateFinanceAssistantSemantics", () => {
  it("accepts an output with no references at all", () => {
    expect(validateFinanceAssistantSemantics(makeOutput(), makeContext()).success).toBe(true);
  });

  it("accepts references to real ids present in context", () => {
    const output = makeOutput({
      financialRiskExplanations: [{ riskId: "invoice:i2", explanation: "Severely overdue." }],
      revenueOpportunities: [{ label: "Finalize", reason: "x", targetType: "contract", targetId: "ct1" }],
      recommendations: [
        { label: "Chase", reason: "x", targetType: "invoice", targetId: "i1" },
        { label: "Review", reason: "x", targetType: "event", targetId: "e1" },
      ],
    });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(true);
  });

  it("rejects a financialRiskExplanation for a risk not in the known risk list", () => {
    const output = makeOutput({ financialRiskExplanations: [{ riskId: "invoice:invented", explanation: "x" }] });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Invoice id", () => {
    const output = makeOutput({ recommendations: [{ label: "x", reason: "x", targetType: "invoice", targetId: "invented_invoice" }] });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Contract id", () => {
    const output = makeOutput({ revenueOpportunities: [{ label: "x", reason: "x", targetType: "contract", targetId: "invented_contract" }] });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Event id", () => {
    const output = makeOutput({ recommendations: [{ label: "x", reason: "x", targetType: "event", targetId: "invented_event" }] });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects a targetType with no targetId", () => {
    const output = makeOutput({ recommendations: [{ label: "x", reason: "x", targetType: "invoice", targetId: null }] });
    expect(validateFinanceAssistantSemantics(output, makeContext()).success).toBe(false);
  });
});
