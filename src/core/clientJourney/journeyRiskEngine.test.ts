import { describe, it, expect } from "vitest";
import { detectJourneyRisks, type RiskSourceData } from "./journeyRiskEngine";
import { makeLead, makeProposal, makeContract, makeInvoice, makeEvent } from "./testFixtures";

const NOW = "2026-02-01T00:00:00.000Z";

function baseSource(overrides: Partial<RiskSourceData> = {}): RiskSourceData {
  return {
    now: NOW,
    currentStage: "qualified",
    lead: null,
    proposal: null,
    contract: null,
    invoice: null,
    focusEvent: null,
    portalActive: true,
    depositRequired: false,
    depositSatisfied: true,
    requiredDocumentsComplete: null,
    operationalPlanExists: null,
    oldestPendingRequestDueDate: null,
    closedAt: null,
    reviewRequestedAt: null,
    rebookingOfferedAt: null,
    ...overrides,
  };
}

describe("detectJourneyRisks", () => {
  it("detects no risks in a healthy, fresh journey", () => {
    expect(detectJourneyRisks(baseSource())).toEqual([]);
  });

  it("flags lead_going_cold after 7+ days of no activity on a new/contacted lead", () => {
    const risks = detectJourneyRisks(baseSource({ lead: makeLead({ status: "contacted", updated_at: "2026-01-20T00:00:00.000Z" }) }));
    expect(risks.some((r) => r.type === "lead_going_cold")).toBe(true);
  });

  it("does not flag lead_going_cold before the threshold", () => {
    const risks = detectJourneyRisks(baseSource({ lead: makeLead({ status: "contacted", updated_at: "2026-01-28T00:00:00.000Z" }) }));
    expect(risks.some((r) => r.type === "lead_going_cold")).toBe(false);
  });

  it("flags proposal_stalled once a reviewed proposal has awaited a decision for 10+ days", () => {
    const risks = detectJourneyRisks(baseSource({ proposal: makeProposal({ reviewed_at: "2026-01-10T00:00:00.000Z", updated_at: "2026-01-18T00:00:00.000Z", status: "draft" }) }));
    expect(risks.some((r) => r.type === "proposal_stalled")).toBe(true);
  });

  it("flags contract_stalled once a sent contract has awaited signature for 7+ days", () => {
    const risks = detectJourneyRisks(baseSource({ contract: makeContract({ sent_at: "2026-01-20T00:00:00.000Z", signature_status: "sent" }) }));
    expect(risks.some((r) => r.type === "contract_stalled")).toBe(true);
  });

  it("flags invoice_overdue for an invoice whose status is already overdue", () => {
    const risks = detectJourneyRisks(baseSource({ invoice: makeInvoice({ status: "overdue" }) }));
    const risk = risks.find((r) => r.type === "invoice_overdue");
    expect(risk?.severity).toBe("critical");
  });

  it("flags deposit_delayed once the invoice has been out for 5+ days with the deposit still unpaid", () => {
    const risks = detectJourneyRisks(baseSource({ depositRequired: true, depositSatisfied: false, invoice: makeInvoice({ sent_at: "2026-01-20T00:00:00.000Z" }) }));
    expect(risks.some((r) => r.type === "deposit_delayed")).toBe(true);
  });

  it("flags portal_not_activated only once the journey has progressed past welcome", () => {
    const early = detectJourneyRisks(baseSource({ currentStage: "welcome", portalActive: false }));
    expect(early.some((r) => r.type === "portal_not_activated")).toBe(false);

    const late = detectJourneyRisks(baseSource({ currentStage: "planning", portalActive: false }));
    expect(late.some((r) => r.type === "portal_not_activated")).toBe(true);
  });

  it("flags planning_delayed when no operational plan exists close to the event date", () => {
    const risks = detectJourneyRisks(baseSource({ focusEvent: makeEvent({ event_date: "2026-02-15" }), operationalPlanExists: false }));
    expect(risks.some((r) => r.type === "planning_delayed")).toBe(true);
  });

  it("flags review_opportunity_missed 30+ days after closing with no review requested", () => {
    const risks = detectJourneyRisks(baseSource({ currentStage: "closed", closedAt: "2025-12-20T00:00:00.000Z" }));
    expect(risks.some((r) => r.type === "review_opportunity_missed")).toBe(true);
  });
});
