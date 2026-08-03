import { describe, it, expect } from "vitest";
import { computeJourneyAnalytics, type JourneyAnalyticsInput } from "./journeyAnalyticsEngine";

const NOW = "2026-02-01T00:00:00.000Z";

function baseInput(overrides: Partial<JourneyAnalyticsInput> = {}): JourneyAnalyticsInput {
  return {
    subjectType: "lead",
    currentStage: "new_lead",
    createdAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    isLead: true,
    convertedToClient: false,
    proposalSent: false,
    proposalAccepted: false,
    contractSent: false,
    contractSigned: false,
    depositRequired: false,
    depositPaid: false,
    isBlocked: false,
    lostOrCancelledAtStage: null,
    followUpCompleted: null,
    reviewCompleted: null,
    rebookingCreated: null,
    stageEnteredAt: {},
    ...overrides,
  };
}

describe("computeJourneyAnalytics", () => {
  it("returns 0 for every rate with no data, never a vacuous 100", () => {
    const analytics = computeJourneyAnalytics([], NOW);
    expect(analytics.leadToClientConversionRate).toBe(0);
    expect(analytics.proposalAcceptanceRate).toBe(0);
    expect(analytics.averageJourneyDurationDays).toBe(0);
  });

  it("computes lead-to-client conversion rate only over lead subjects", () => {
    const inputs = [baseInput({ isLead: true, convertedToClient: true }), baseInput({ isLead: true, convertedToClient: false }), baseInput({ isLead: false })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.leadToClientConversionRate).toBe(50);
  });

  it("computes proposal acceptance rate only over journeys that had a proposal sent", () => {
    const inputs = [baseInput({ proposalSent: true, proposalAccepted: true }), baseInput({ proposalSent: true, proposalAccepted: false }), baseInput({ proposalSent: false })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.proposalAcceptanceRate).toBe(50);
  });

  it("counts blocked journeys directly from the isBlocked flag", () => {
    const inputs = [baseInput({ isBlocked: true }), baseInput({ isBlocked: true }), baseInput({ isBlocked: false })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.blockedJourneyCount).toBe(2);
  });

  it("computes average journey duration only over closed journeys", () => {
    const inputs = [baseInput({ createdAt: "2026-01-01T00:00:00.000Z", closedAt: "2026-01-11T00:00:00.000Z" }), baseInput({ createdAt: "2026-01-01T00:00:00.000Z", closedAt: null })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.averageJourneyDurationDays).toBe(10);
  });

  it("groups drop-off points by the exact stage a journey was lost or cancelled at", () => {
    const inputs = [baseInput({ lostOrCancelledAtStage: "proposal_sent" }), baseInput({ lostOrCancelledAtStage: "proposal_sent" }), baseInput({ lostOrCancelledAtStage: "contract_sent" })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.dropOffPoints[0]).toEqual({ stage: "proposal_sent", count: 2 });
  });

  it("computes average time per stage from stageEnteredAt timestamps", () => {
    const inputs = [baseInput({ stageEnteredAt: { new_lead: "2026-01-01T00:00:00.000Z", contacted: "2026-01-03T00:00:00.000Z" } })];
    const analytics = computeJourneyAnalytics(inputs, NOW);
    expect(analytics.averageTimePerStageDays.new_lead).toBe(2);
  });
});
