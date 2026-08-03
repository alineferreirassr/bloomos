import { describe, expect, it } from "vitest";
import { assembleCrmAssistantBrief } from "@/modules/ai/crmAssistant/assembleBrief";
import type { CrmAssistantContext, CRMAssistantModelOutput } from "@/modules/ai/crmAssistant/types";
import type { AIMemoryEntry } from "@/types/aiMemory";

function makeMemory(overrides: Partial<AIMemoryEntry> = {}): AIMemoryEntry {
  return {
    id: "mem_1",
    workspace_id: "ws_1",
    skill_id: "proposal.generate",
    entity_type: null,
    entity_id: null,
    title: "Accepted proposal",
    summary: "Client accepted the proposal.",
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

function makeContext(overrides: Partial<CrmAssistantContext> = {}): CrmAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    totalClientCount: 3,
    totalLeadCount: 2,
    priorityClients: [{ clientId: "c1", name: "VIP Client", status: "active", isVip: true, isReturning: false, tags: [], createdAt: "2026-01-01T00:00:00.000Z" }],
    inactiveClients: [{ clientId: "c3", name: "Inactive Client", status: "inactive", isVip: false, isReturning: false, tags: [], createdAt: "2026-01-01T00:00:00.000Z" }],
    clientsAtRisk: [{ clientId: "c2", name: "Risky Client", reasons: ["Unsigned contract C-1"] }],
    activeLeads: [],
    upcomingEvents: [],
    pastEvents: [],
    unsignedContracts: [{ contractId: "ct1", contractNumber: "C-1", clientId: "c2", eventId: null, signatureStatus: "unsigned", effectiveDate: null }],
    outstandingInvoices: [{ invoiceId: "inv1", invoiceNumber: "INV-1", clientId: "c2", eventId: null, status: "overdue", balanceMinor: 5000, currency: "USD", dueDate: null }],
    outstandingBalanceMinor: 5000,
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

function makeOutput(overrides: Partial<CRMAssistantModelOutput> = {}): CRMAssistantModelOutput {
  return {
    executiveSummary: "Summary.",
    relationshipHealthSummary: "Healthy overall.",
    clientRiskExplanations: [],
    upcomingOpportunities: [],
    suggestedFollowUps: [],
    recommendedActions: [],
    ...overrides,
  };
}

describe("assembleCrmAssistantBrief", () => {
  it("carries the model's narrative fields through untouched", () => {
    const brief = assembleCrmAssistantBrief(makeOutput({ executiveSummary: "Custom summary." }), makeContext());
    expect(brief.executiveSummary).toBe("Custom summary.");
    expect(brief.relationshipHealth.summary).toBe("Healthy overall.");
  });

  it("computes relationshipHealth counts entirely from context, never the model", () => {
    const brief = assembleCrmAssistantBrief(makeOutput(), makeContext());
    expect(brief.relationshipHealth).toEqual({
      summary: "Healthy overall.",
      totalClients: 3,
      totalLeads: 2,
      priorityClientCount: 1,
      inactiveClientCount: 1,
      atRiskClientCount: 1,
    });
  });

  it("merges the model's per-client risk explanation by clientId, defaulting to null when absent", () => {
    const output = makeOutput({ clientRiskExplanations: [{ clientId: "c2", explanation: "Contract overdue for signature." }] });
    const brief = assembleCrmAssistantBrief(output, makeContext());
    expect(brief.clientsAtRisk).toHaveLength(1);
    expect(brief.clientsAtRisk[0].explanation).toBe("Contract overdue for signature.");
  });

  it("leaves explanation null for an at-risk client the model didn't explain", () => {
    const brief = assembleCrmAssistantBrief(makeOutput(), makeContext());
    expect(brief.clientsAtRisk[0].explanation).toBeNull();
  });

  it("passes unsignedContracts/outstandingPayments/outstandingBalance straight through from context, deterministically", () => {
    const brief = assembleCrmAssistantBrief(makeOutput(), makeContext());
    expect(brief.unsignedContracts).toEqual(makeContext().unsignedContracts);
    expect(brief.outstandingPayments).toEqual(makeContext().outstandingInvoices);
    expect(brief.outstandingBalanceMinor).toBe(5000);
  });

  it("resolves every action's targetType/targetId into a real actionTarget href", () => {
    const output = makeOutput({ recommendedActions: [{ label: "Chase contract", reason: "x", targetType: "contract", targetId: "ct1" }] });
    const brief = assembleCrmAssistantBrief(output, makeContext());
    expect(brief.recommendedActions[0].actionTarget).toEqual({ type: "contract", href: "/contracts/ct1", label: "Open Contract" });
  });

  it("confidence and missingInformation come from context.unavailableCategories, never the model", () => {
    const brief = assembleCrmAssistantBrief(makeOutput(), makeContext({ unavailableCategories: ["finance"] }));
    expect(brief.confidence).toBe(88);
    expect(brief.missingInformation).toEqual(["Invoices could not be read this time."]);
  });

  it("surfaces up to 5 relevant memories from context.recentMemories", () => {
    const memories = Array.from({ length: 8 }, (_, i) => makeMemory({ id: `mem_${i}` }));
    const brief = assembleCrmAssistantBrief(makeOutput(), makeContext({ recentMemories: memories }));
    expect(brief.relevantMemories).toHaveLength(5);
  });
});
