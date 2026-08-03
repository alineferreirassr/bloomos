import { describe, expect, it } from "vitest";
import { createCrmAssistantMockProvider } from "@/modules/ai/crmAssistant/mockProvider";
import { crmAssistantModelOutputSchema } from "@/modules/ai/crmAssistant/schema";
import type { CrmAssistantContext } from "@/modules/ai/crmAssistant/types";
import type { AICompletionRequest } from "@/core/ai/types";

function makeContext(overrides: Partial<CrmAssistantContext> = {}): CrmAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    totalClientCount: 2,
    totalLeadCount: 1,
    priorityClients: [],
    inactiveClients: [],
    clientsAtRisk: [{ clientId: "c1", name: "Risky Client", reasons: ["Unsigned contract C-1"] }],
    activeLeads: [{ leadId: "l1", name: "Test Lead", status: "qualified", source: "Website", eventType: null, eventDate: null, createdAt: "2026-01-01T00:00:00.000Z" }],
    upcomingEvents: [],
    pastEvents: [],
    unsignedContracts: [{ contractId: "ct1", contractNumber: "C-1", clientId: "c1", eventId: null, signatureStatus: "unsigned", effectiveDate: null }],
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

function makeRequest(context: CrmAssistantContext | undefined): AICompletionRequest {
  return {
    conversation: {
      id: "conv_1",
      workspaceId: "ws_1",
      context: { workspaceId: "ws_1", ownerType: "event", ownerId: "ws_1", facts: { crmAssistantContext: context } },
      messages: [],
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    },
    prompt: { role: "user", content: "" },
  };
}

describe("createCrmAssistantMockProvider", () => {
  it("returns a schema-valid completion reflecting the real supplied context", async () => {
    const provider = createCrmAssistantMockProvider();
    const context = makeContext();
    const completion = await provider.complete(makeRequest(context));
    const parsed = JSON.parse(completion.content);

    expect(crmAssistantModelOutputSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.clientRiskExplanations).toHaveLength(1);
    expect(parsed.clientRiskExplanations[0].clientId).toBe("c1");
    expect(parsed.recommendedActions.some((a: { targetId: string }) => a.targetId === "ct1")).toBe(true);
  });

  it("returns a safe error completion when no context was supplied, never throwing", async () => {
    const provider = createCrmAssistantMockProvider();
    const completion = await provider.complete(makeRequest(undefined));
    expect(completion.finishReason).toBe("error");
    const parsed = JSON.parse(completion.content);
    expect(crmAssistantModelOutputSchema.safeParse(parsed).success).toBe(true);
  });

  it("never invents a client, lead, contract, or invoice id not present in context", async () => {
    const provider = createCrmAssistantMockProvider();
    const context = makeContext();
    const completion = await provider.complete(makeRequest(context));
    const parsed = JSON.parse(completion.content);

    const knownClientIds = new Set(context.clientsAtRisk.map((c) => c.clientId));
    const knownLeadIds = new Set(context.activeLeads.map((l) => l.leadId));
    const knownContractIds = new Set(context.unsignedContracts.map((c) => c.contractId));

    for (const entry of parsed.clientRiskExplanations) expect(knownClientIds.has(entry.clientId)).toBe(true);
    for (const action of [...parsed.upcomingOpportunities, ...parsed.suggestedFollowUps, ...parsed.recommendedActions]) {
      if (action.targetType === "lead") expect(knownLeadIds.has(action.targetId)).toBe(true);
      if (action.targetType === "contract") expect(knownContractIds.has(action.targetId)).toBe(true);
    }
  });
});
