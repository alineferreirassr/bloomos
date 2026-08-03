import { describe, expect, it } from "vitest";
import { assembleFinanceAssistantBrief } from "@/modules/ai/financeAssistant/assembleBrief";
import type { FinanceAssistantContext, FinanceAssistantModelOutput } from "@/modules/ai/financeAssistant/types";
import type { AIMemoryEntry } from "@/types/aiMemory";

function makeMemory(overrides: Partial<AIMemoryEntry> = {}): AIMemoryEntry {
  return {
    id: "mem_1",
    workspace_id: "ws_1",
    skill_id: null,
    entity_type: null,
    entity_id: null,
    title: "Prior financial decision",
    summary: "Client was given a payment extension.",
    category: "operational_knowledge",
    importance: "medium",
    visibility: "workspace",
    user_id: null,
    tags: [],
    confidence: 100,
    source: "human",
    approval_status: "approved",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    expires_at: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<FinanceAssistantContext> = {}): FinanceAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    currency: "USD",
    revenueThisMonthMinor: 10000,
    collectedThisMonthMinor: 5000,
    totalInvoicedAllTimeMinor: 20000,
    totalCollectedAllTimeMinor: 15000,
    outstandingReceivablesMinor: 5000,
    overdueReceivablesMinor: 5000,
    refundsThisMonthMinor: 500,
    depositsPendingMinor: 0,
    expensesThisMonthMinor: 1000,
    netCashPositionMinor: 4000,
    outstandingInvoices: [{ invoiceId: "i1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, status: "sent", balanceMinor: 5000, totalMinor: 5000, currency: "USD", dueDate: null }],
    paymentDelays: [{ invoiceId: "i2", invoiceNumber: "INV-2", clientId: "c1", eventId: null, status: "overdue", balanceMinor: 5000, totalMinor: 5000, currency: "USD", dueDate: "2026-07-01" }],
    upcomingRevenue: [{ invoiceId: "i3", invoiceNumber: "INV-3", clientId: "c1", eventId: null, status: "sent", balanceMinor: 3000, totalMinor: 3000, currency: "USD", dueDate: "2026-08-01" }],
    refunds: [],
    contractValueTotalMinor: 100000,
    contractValueSignedMinor: 40000,
    contractValueUnsignedMinor: 60000,
    unsignedContracts: [{ contractId: "ct1", contractNumber: "C-1", clientId: "c1", eventId: null, status: "sent", signatureStatus: "unsigned", totalValueMinor: 60000, currency: "USD", effectiveDate: null }],
    proposalValues: [],
    upcomingEvents: [],
    financialRisks: [{ riskId: "invoice:i2", targetType: "invoice", targetId: "i2", label: "Invoice INV-2 severely overdue", reasons: ["25 day(s) overdue"] }],
    recentDailyBriefs: [],
    recentActivity: [],
    crmRecommendations: [{ clientId: "c1", name: "Jane Doe", reasons: ["Unsigned contract"] }],
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

describe("assembleFinanceAssistantBrief", () => {
  it("carries the model's narrative fields through untouched", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput({ executiveSummary: "Custom summary." }), makeContext());
    expect(brief.executiveSummary).toBe("Custom summary.");
    expect(brief.revenueOverview.summary).toBe("Overview.");
    expect(brief.cashFlowSnapshot.summary).toBe("Cash flow.");
  });

  it("computes revenueOverview/cashFlowSnapshot numbers entirely from context, never the model", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext());
    expect(brief.revenueOverview.revenueThisMonthMinor).toBe(10000);
    expect(brief.cashFlowSnapshot.collectedMinor).toBe(5000);
    expect(brief.cashFlowSnapshot.upcomingMinor).toBe(3000);
    expect(brief.cashFlowSnapshot.expensesMinor).toBe(1000);
    expect(brief.cashFlowSnapshot.netCashPositionMinor).toBe(4000);
  });

  it("merges the model's per-risk explanation by riskId, defaulting to null when absent", () => {
    const output = makeOutput({ financialRiskExplanations: [{ riskId: "invoice:i2", explanation: "Client unresponsive." }] });
    const brief = assembleFinanceAssistantBrief(output, makeContext());
    expect(brief.financialRisks).toHaveLength(1);
    expect(brief.financialRisks[0].explanation).toBe("Client unresponsive.");
  });

  it("leaves explanation null for a risk the model didn't explain", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext());
    expect(brief.financialRisks[0].explanation).toBeNull();
  });

  it("passes outstandingPayments/upcomingRevenue/paymentDelays/contractValue straight through from context, deterministically", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext());
    expect(brief.outstandingPayments).toEqual(makeContext().outstandingInvoices);
    expect(brief.upcomingRevenue).toEqual(makeContext().upcomingRevenue);
    expect(brief.paymentDelays).toEqual(makeContext().paymentDelays);
    expect(brief.contractValue).toEqual({ totalMinor: 100000, signedMinor: 40000, unsignedMinor: 60000, currency: "USD" });
  });

  it("resolves every action's targetType/targetId into a real actionTarget href", () => {
    const output = makeOutput({ recommendations: [{ label: "Chase invoice", reason: "x", targetType: "invoice", targetId: "i2" }] });
    const brief = assembleFinanceAssistantBrief(output, makeContext());
    expect(brief.recommendations[0].actionTarget).toEqual({ type: "invoice", href: "/finance/invoices/i2", label: "Open Invoice" });
  });

  it("confidence and missingInformation come from context.unavailableCategories, never the model", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext({ unavailableCategories: ["payments"] }));
    expect(brief.confidence).toBe(88);
    expect(brief.missingInformation).toEqual(["Payments could not be read this time."]);
  });

  it("surfaces up to 5 relevant memories from context.recentMemories", () => {
    const memories = Array.from({ length: 8 }, (_, i) => makeMemory({ id: `mem_${i}` }));
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext({ recentMemories: memories }));
    expect(brief.relevantMemories).toHaveLength(5);
  });

  it("passes crmRecommendations straight through from context", () => {
    const brief = assembleFinanceAssistantBrief(makeOutput(), makeContext());
    expect(brief.crmRecommendations).toEqual([{ clientId: "c1", name: "Jane Doe", reasons: ["Unsigned contract"] }]);
  });
});
