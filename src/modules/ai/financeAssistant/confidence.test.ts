import { describe, expect, it } from "vitest";
import { computeFinanceAssistantConfidence, computeFinanceAssistantMissingInformation } from "@/modules/ai/financeAssistant/confidence";
import type { FinanceAssistantContext } from "@/modules/ai/financeAssistant/types";

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
    outstandingInvoices: [],
    paymentDelays: [],
    upcomingRevenue: [],
    refunds: [],
    contractValueTotalMinor: 0,
    contractValueSignedMinor: 0,
    contractValueUnsignedMinor: 0,
    unsignedContracts: [],
    proposalValues: [],
    upcomingEvents: [],
    financialRisks: [],
    recentDailyBriefs: [],
    recentActivity: [],
    crmRecommendations: [],
    recentMemories: [],
    unavailableCategories: [],
    ...overrides,
  };
}

describe("computeFinanceAssistantConfidence", () => {
  it("is 100 when every category was read successfully, regardless of how empty the results are", () => {
    const result = computeFinanceAssistantConfidence(makeContext());
    expect(result.score).toBe(100);
    expect(result.reason).toBe("Every data category was read successfully.");
  });

  it("deducts an equal share per unavailable category and names them", () => {
    const result = computeFinanceAssistantConfidence(makeContext({ unavailableCategories: ["payments"] }));
    expect(result.score).toBe(88);
    expect(result.reason).toContain("Payments");
  });

  it("drops further with more unavailable categories", () => {
    const result = computeFinanceAssistantConfidence(makeContext({ unavailableCategories: ["payments", "invoices", "contracts"] }));
    expect(result.score).toBe(63);
  });
});

describe("computeFinanceAssistantMissingInformation", () => {
  it("is empty when nothing failed to read", () => {
    expect(computeFinanceAssistantMissingInformation(makeContext())).toEqual([]);
  });

  it("never lists a genuinely empty (but successfully read) category as missing", () => {
    expect(computeFinanceAssistantMissingInformation(makeContext({ financialRisks: [] }))).toEqual([]);
  });

  it("names each unavailable category with a read-failure message", () => {
    const info = computeFinanceAssistantMissingInformation(makeContext({ unavailableCategories: ["activity"] }));
    expect(info).toEqual(["Recent activity could not be read this time."]);
  });
});
