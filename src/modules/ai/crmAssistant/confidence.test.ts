import { describe, expect, it } from "vitest";
import { computeCrmAssistantConfidence, computeCrmAssistantMissingInformation } from "@/modules/ai/crmAssistant/confidence";
import type { CrmAssistantContext } from "@/modules/ai/crmAssistant/types";

function makeContext(overrides: Partial<CrmAssistantContext> = {}): CrmAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    totalClientCount: 0,
    totalLeadCount: 0,
    priorityClients: [],
    inactiveClients: [],
    clientsAtRisk: [],
    activeLeads: [],
    upcomingEvents: [],
    pastEvents: [],
    unsignedContracts: [],
    outstandingInvoices: [],
    outstandingBalanceMinor: 0,
    outstandingCurrency: "USD",
    proposalHistory: [],
    recentDailyBriefs: [],
    recentActivity: [],
    communicationSummary: { totalLoggedTouchpoints: 0, mostRecentTouchpointAt: null },
    recentMemories: [],
    unavailableCategories: [],
    ...overrides,
  };
}

describe("computeCrmAssistantConfidence", () => {
  it("is 100 when every category was read successfully, regardless of how empty the results are", () => {
    const result = computeCrmAssistantConfidence(makeContext());
    expect(result.score).toBe(100);
    expect(result.reason).toBe("Every data category was read successfully.");
  });

  it("deducts an equal share per unavailable category and names them", () => {
    const result = computeCrmAssistantConfidence(makeContext({ unavailableCategories: ["finance"] }));
    expect(result.score).toBe(88);
    expect(result.reason).toContain("Invoices");
  });

  it("drops further with more unavailable categories", () => {
    const result = computeCrmAssistantConfidence(makeContext({ unavailableCategories: ["finance", "clients", "leads"] }));
    expect(result.score).toBe(63);
  });
});

describe("computeCrmAssistantMissingInformation", () => {
  it("is empty when nothing failed to read", () => {
    expect(computeCrmAssistantMissingInformation(makeContext())).toEqual([]);
  });

  it("never lists a genuinely empty (but successfully read) category as missing", () => {
    const info = computeCrmAssistantMissingInformation(makeContext({ clientsAtRisk: [] }));
    expect(info).toEqual([]);
  });

  it("names each unavailable category with a read-failure message", () => {
    const info = computeCrmAssistantMissingInformation(makeContext({ unavailableCategories: ["activity"] }));
    expect(info).toEqual(["Recent activity could not be read this time."]);
  });
});
