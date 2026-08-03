import { describe, it, expect } from "vitest";
import { generateNextBestActions, type NextBestActionSourceData } from "./nextBestActionEngine";
import { makeLead, makeProposal, makeContract, makeInvoice } from "./testFixtures";
import type { JourneyBlocker } from "@/types/clientJourney";

function blocker(type: JourneyBlocker["type"]): JourneyBlocker {
  return { id: "b1", type, stage: "qualified", severity: "high", sourceModule: "x", sourceRecordId: null, description: "", suggestedNextAction: "", detectedAt: "2026-01-01T00:00:00.000Z" };
}

function baseSource(overrides: Partial<NextBestActionSourceData> = {}): NextBestActionSourceData {
  return {
    subjectType: "client",
    subjectId: "client_1",
    currentStage: "qualified",
    blockers: [],
    lead: null,
    proposal: null,
    contract: null,
    invoice: null,
    reviewRequestedAt: null,
    rebookingOfferedAt: null,
    ...overrides,
  };
}

describe("generateNextBestActions", () => {
  it("suggests sending a first-contact message for a brand-new lead", () => {
    const actions = generateNextBestActions(baseSource({ subjectType: "lead", subjectId: "lead_1", lead: makeLead({ status: "new" }) }));
    expect(actions.some((a) => a.type === "send_first_contact_message")).toBe(true);
  });

  it("suggests sending the proposal once it exists but hasn't been reviewed", () => {
    const actions = generateNextBestActions(baseSource({ currentStage: "proposal_preparation", proposal: makeProposal({ reviewed_at: null, status: "draft" }) }));
    expect(actions.some((a) => a.type === "send_proposal")).toBe(true);
  });

  it("suggests requesting a signature when the contract_unsigned blocker is present", () => {
    const actions = generateNextBestActions(baseSource({ blockers: [blocker("contract_unsigned")], contract: makeContract({ status: "sent" }) }));
    const action = actions.find((a) => a.type === "request_signature");
    expect(action?.priority).toBe("critical");
  });

  it("suggests following up on the deposit at critical priority", () => {
    const actions = generateNextBestActions(baseSource({ blockers: [blocker("deposit_unpaid")], invoice: makeInvoice() }));
    const action = actions.find((a) => a.type === "follow_up_on_deposit");
    expect(action?.priority).toBe("critical");
  });

  it("suggests requesting a review once the journey is closed and none has been requested", () => {
    const actions = generateNextBestActions(baseSource({ currentStage: "closed", reviewRequestedAt: null }));
    expect(actions.some((a) => a.type === "request_review")).toBe(true);
  });

  it("does not suggest requesting a review twice", () => {
    const actions = generateNextBestActions(baseSource({ currentStage: "closed", reviewRequestedAt: "2026-02-01T00:00:00.000Z" }));
    expect(actions.some((a) => a.type === "request_review")).toBe(false);
  });

  it("every action carries the exact related subject and a deep link", () => {
    const actions = generateNextBestActions(baseSource({ subjectType: "client", subjectId: "client_42", currentStage: "welcome" }));
    for (const action of actions) {
      expect(action.relatedSubjectType).toBe("client");
      expect(action.relatedSubjectId).toBe("client_42");
      expect(action.deepLink).toBe("/clients/client_42");
    }
  });

  it("suggests nothing when there is no signal to act on", () => {
    const actions = generateNextBestActions(baseSource({ currentStage: "service_in_progress" }));
    expect(actions).toEqual([]);
  });
});
