import { describe, expect, it } from "vitest";
import { validateCrmAssistantSemantics } from "@/modules/ai/crmAssistant/semanticValidation";
import type { CrmAssistantContext, CRMAssistantModelOutput } from "@/modules/ai/crmAssistant/types";

function makeContext(overrides: Partial<CrmAssistantContext> = {}): CrmAssistantContext {
  return {
    generatedAt: "2026-07-26T00:00:00.000Z",
    totalClientCount: 1,
    totalLeadCount: 1,
    priorityClients: [{ clientId: "c1", name: "Priority Client", status: "active", isVip: true, isReturning: false, tags: [], createdAt: "2026-01-01T00:00:00.000Z" }],
    inactiveClients: [],
    clientsAtRisk: [{ clientId: "c2", name: "At Risk Client", reasons: ["Unsigned contract C-1"] }],
    activeLeads: [{ leadId: "l1", name: "Test Lead", status: "qualified", source: "Website", eventType: null, eventDate: null, createdAt: "2026-01-01T00:00:00.000Z" }],
    upcomingEvents: [{ eventId: "e1", title: "Test Event", eventDate: "2026-08-01", clientId: "c1", status: "confirmed", lifecycleStage: "planning" }],
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
    relationshipHealthSummary: "Healthy.",
    clientRiskExplanations: [],
    upcomingOpportunities: [],
    suggestedFollowUps: [],
    recommendedActions: [],
    ...overrides,
  };
}

describe("validateCrmAssistantSemantics", () => {
  it("accepts an output with no references at all", () => {
    const result = validateCrmAssistantSemantics(makeOutput(), makeContext());
    expect(result.success).toBe(true);
  });

  it("accepts references to real ids present in context", () => {
    const output = makeOutput({
      clientRiskExplanations: [{ clientId: "c2", explanation: "Unsigned contract." }],
      upcomingOpportunities: [{ label: "Follow up", reason: "x", targetType: "lead", targetId: "l1" }],
      suggestedFollowUps: [{ label: "Check in", reason: "x", targetType: "client", targetId: "c1" }],
      recommendedActions: [
        { label: "Chase contract", reason: "x", targetType: "contract", targetId: "ct1" },
        { label: "Chase invoice", reason: "x", targetType: "invoice", targetId: "inv1" },
        { label: "Review event", reason: "x", targetType: "event", targetId: "e1" },
      ],
    });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(true);
  });

  it("rejects a clientRiskExplanation for a client not in the at-risk list", () => {
    const output = makeOutput({ clientRiskExplanations: [{ clientId: "invented_client", explanation: "x" }] });
    const result = validateCrmAssistantSemantics(output, makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects a clientRiskExplanation for a real client who isn't at risk (only priority)", () => {
    const output = makeOutput({ clientRiskExplanations: [{ clientId: "c1", explanation: "x" }] });
    const result = validateCrmAssistantSemantics(output, makeContext());
    expect(result.success).toBe(false);
  });

  it("rejects an invented Lead id", () => {
    const output = makeOutput({ upcomingOpportunities: [{ label: "x", reason: "x", targetType: "lead", targetId: "invented_lead" }] });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Contract id", () => {
    const output = makeOutput({ recommendedActions: [{ label: "x", reason: "x", targetType: "contract", targetId: "invented_contract" }] });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Invoice id", () => {
    const output = makeOutput({ recommendedActions: [{ label: "x", reason: "x", targetType: "invoice", targetId: "invented_invoice" }] });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects an invented Event id", () => {
    const output = makeOutput({ upcomingOpportunities: [{ label: "x", reason: "x", targetType: "event", targetId: "invented_event" }] });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(false);
  });

  it("rejects a targetType with no targetId", () => {
    const output = makeOutput({ suggestedFollowUps: [{ label: "x", reason: "x", targetType: "client", targetId: null }] });
    expect(validateCrmAssistantSemantics(output, makeContext()).success).toBe(false);
  });
});
