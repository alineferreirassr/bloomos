import { describe, expect, it } from "vitest";
import { createFinanceAssistantMockProvider } from "@/modules/ai/financeAssistant/mockProvider";
import { financeAssistantModelOutputSchema } from "@/modules/ai/financeAssistant/schema";
import type { FinanceAssistantContext } from "@/modules/ai/financeAssistant/types";
import type { AICompletionRequest } from "@/core/ai/types";

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
    refundsThisMonthMinor: 0,
    depositsPendingMinor: 0,
    expensesThisMonthMinor: 1000,
    netCashPositionMinor: 4000,
    outstandingInvoices: [],
    paymentDelays: [{ invoiceId: "i1", invoiceNumber: "INV-1", clientId: "c1", eventId: null, status: "overdue", balanceMinor: 5000, totalMinor: 5000, currency: "USD", dueDate: "2026-07-01" }],
    upcomingRevenue: [],
    refunds: [],
    contractValueTotalMinor: 100000,
    contractValueSignedMinor: 0,
    contractValueUnsignedMinor: 100000,
    unsignedContracts: [{ contractId: "ct1", contractNumber: "C-1", clientId: "c1", eventId: null, status: "sent", signatureStatus: "unsigned", totalValueMinor: 100000, currency: "USD", effectiveDate: null }],
    proposalValues: [],
    upcomingEvents: [],
    financialRisks: [{ riskId: "invoice:i1", targetType: "invoice", targetId: "i1", label: "Invoice INV-1 severely overdue", reasons: ["25 day(s) overdue"] }],
    recentDailyBriefs: [],
    recentActivity: [],
    crmRecommendations: [],
    recentMemories: [],
    unavailableCategories: [],
    ...overrides,
  };
}

function makeRequest(context: FinanceAssistantContext | undefined): AICompletionRequest {
  return {
    conversation: {
      id: "conv_1",
      workspaceId: "ws_1",
      context: { workspaceId: "ws_1", ownerType: "event", ownerId: "ws_1", facts: { financeAssistantContext: context } },
      messages: [],
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    },
    prompt: { role: "user", content: "" },
  };
}

describe("createFinanceAssistantMockProvider", () => {
  it("returns a schema-valid completion reflecting the real supplied context", async () => {
    const provider = createFinanceAssistantMockProvider();
    const context = makeContext();
    const completion = await provider.complete(makeRequest(context));
    const parsed = JSON.parse(completion.content);

    expect(financeAssistantModelOutputSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.financialRiskExplanations).toHaveLength(1);
    expect(parsed.financialRiskExplanations[0].riskId).toBe("invoice:i1");
    expect(parsed.revenueOpportunities.some((a: { targetId: string }) => a.targetId === "ct1")).toBe(true);
    expect(parsed.recommendations.some((a: { targetId: string }) => a.targetId === "i1")).toBe(true);
  });

  it("returns a safe error completion when no context was supplied, never throwing", async () => {
    const provider = createFinanceAssistantMockProvider();
    const completion = await provider.complete(makeRequest(undefined));
    expect(completion.finishReason).toBe("error");
    const parsed = JSON.parse(completion.content);
    expect(financeAssistantModelOutputSchema.safeParse(parsed).success).toBe(true);
  });

  it("never invents an invoice or contract id not present in context", async () => {
    const provider = createFinanceAssistantMockProvider();
    const context = makeContext();
    const completion = await provider.complete(makeRequest(context));
    const parsed = JSON.parse(completion.content);

    const knownInvoiceIds = new Set(context.paymentDelays.map((i) => i.invoiceId));
    const knownContractIds = new Set(context.unsignedContracts.map((c) => c.contractId));

    for (const action of [...parsed.revenueOpportunities, ...parsed.recommendations]) {
      if (action.targetType === "invoice") expect(knownInvoiceIds.has(action.targetId)).toBe(true);
      if (action.targetType === "contract") expect(knownContractIds.has(action.targetId)).toBe(true);
    }
  });
});
