import { describe, it, expect } from "vitest";
import { detectJourneyBlockers, type BlockerSourceData } from "./journeyBlockerEngine";
import { makeLead, makeClient, makeProposal, makeContract, makeEvent, makeClientAccount } from "./testFixtures";

function baseSource(overrides: Partial<BlockerSourceData> = {}): BlockerSourceData {
  return {
    subjectType: "client",
    lead: null,
    client: makeClient(),
    proposal: null,
    acceptedProposal: null,
    contract: null,
    invoice: null,
    focusEvent: null,
    clientAccounts: [],
    depositRequired: false,
    depositSatisfied: true,
    outstandingBalanceMinor: 0,
    requiredDocumentsComplete: null,
    operationalPlanExists: null,
    executionPackageExists: null,
    pendingApprovalsCount: 0,
    clientResponsePendingCount: 0,
    overdueInternalFollowUpsCount: 0,
    now: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("detectJourneyBlockers", () => {
  it("detects no blockers for a clean, uncomplicated state", () => {
    expect(detectJourneyBlockers("qualified", baseSource())).toEqual([]);
  });

  it("flags missing_contact_information for a lead with no email or phone", () => {
    const blockers = detectJourneyBlockers("contacted", baseSource({ subjectType: "lead", lead: makeLead({ email: "", phone: null }) }));
    expect(blockers.some((b) => b.type === "missing_contact_information")).toBe(true);
  });

  it("flags contract_missing once a proposal is accepted but no contract exists", () => {
    const blockers = detectJourneyBlockers("proposal_accepted", baseSource({ acceptedProposal: makeProposal({ status: "accepted" }) }));
    expect(blockers.some((b) => b.type === "contract_missing")).toBe(true);
  });

  it("flags contract_unsigned at high severity for a sent-but-unsigned contract", () => {
    const blockers = detectJourneyBlockers("contract_sent", baseSource({ contract: makeContract({ status: "sent", signature_status: "sent" }) }));
    const blocker = blockers.find((b) => b.type === "contract_unsigned");
    expect(blocker?.severity).toBe("high");
  });

  it("does not flag contract_unsigned for a declined contract", () => {
    const blockers = detectJourneyBlockers("contract_sent", baseSource({ contract: makeContract({ status: "declined", signature_status: "unsigned" }) }));
    expect(blockers.some((b) => b.type === "contract_unsigned")).toBe(false);
  });

  it("flags deposit_unpaid at critical severity when a deposit is required and unpaid", () => {
    const blockers = detectJourneyBlockers("deposit_pending", baseSource({ depositRequired: true, depositSatisfied: false }));
    const blocker = blockers.find((b) => b.type === "deposit_unpaid");
    expect(blocker?.severity).toBe("critical");
  });

  it("flags final_balance_unpaid only when the event is completed with an outstanding balance", () => {
    const notCompleted = detectJourneyBlockers("final_balance_pending", baseSource({ focusEvent: makeEvent({ status: "in_progress" }), outstandingBalanceMinor: 5000 }));
    expect(notCompleted.some((b) => b.type === "final_balance_unpaid")).toBe(false);

    const completed = detectJourneyBlockers("final_balance_pending", baseSource({ focusEvent: makeEvent({ status: "completed" }), outstandingBalanceMinor: 5000 }));
    expect(completed.some((b) => b.type === "final_balance_unpaid")).toBe(true);
  });

  it("flags missing_portal_access only once the journey has reached welcome or later", () => {
    const early = detectJourneyBlockers("proposal_sent", baseSource());
    expect(early.some((b) => b.type === "missing_portal_access")).toBe(false);

    const late = detectJourneyBlockers("welcome", baseSource());
    expect(late.some((b) => b.type === "missing_portal_access")).toBe(true);

    const activated = detectJourneyBlockers("welcome", baseSource({ clientAccounts: [makeClientAccount({ status: "active" })] }));
    expect(activated.some((b) => b.type === "missing_portal_access")).toBe(false);
  });

  it("flags missing_operational_plan only once planning has started", () => {
    const early = detectJourneyBlockers("welcome", baseSource({ operationalPlanExists: false }));
    expect(early.some((b) => b.type === "missing_operational_plan")).toBe(false);

    const late = detectJourneyBlockers("planning", baseSource({ operationalPlanExists: false }));
    expect(late.some((b) => b.type === "missing_operational_plan")).toBe(true);
  });

  it("flags client_response_pending and internal_follow_up_overdue from plain counts", () => {
    const blockers = detectJourneyBlockers("welcome", baseSource({ clientResponsePendingCount: 2, overdueInternalFollowUpsCount: 1 }));
    expect(blockers.some((b) => b.type === "client_response_pending")).toBe(true);
    expect(blockers.some((b) => b.type === "internal_follow_up_overdue")).toBe(true);
  });

  it("flags missing_event_information for an event with no date or guest count", () => {
    const blockers = detectJourneyBlockers("discovery", baseSource({ focusEvent: makeEvent({ event_date: null, guest_count: null }) }));
    expect(blockers.some((b) => b.type === "missing_event_information")).toBe(true);
  });
});
