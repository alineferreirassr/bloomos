import { describe, expect, it } from "vitest";
import {
  canTransitionContractStatus,
  getContractNextRecommendedAction,
  getNextContractStatuses,
  isContractClosed,
  isContractStatusTerminal,
  CONTRACT_STATUSES,
  CLOSED_CONTRACT_STATUSES,
} from "@/core/workflows/contractWorkflow";

describe("isContractStatusTerminal", () => {
  it("is true only for the locked (dedicated-action-only) statuses", () => {
    const locked = ["sent", "viewed", "signed", "completed", "expired", "cancelled", "archived", "declined"] as const;
    for (const status of locked) {
      expect(isContractStatusTerminal(status)).toBe(true);
    }
    for (const status of ["draft", "review", "ready"] as const) {
      expect(isContractStatusTerminal(status)).toBe(false);
    }
  });
});

describe("isContractClosed", () => {
  it("is true only for statuses with genuinely nothing left to do", () => {
    for (const status of CLOSED_CONTRACT_STATUSES) {
      expect(isContractClosed(status)).toBe(true);
    }
  });

  it("is false for sent/viewed/signed even though they're entry-restricted", () => {
    expect(isContractClosed("sent")).toBe(false);
    expect(isContractClosed("viewed")).toBe(false);
    expect(isContractClosed("signed")).toBe(false);
  });

  it("is false for the draft/review/ready working statuses", () => {
    expect(isContractClosed("draft")).toBe(false);
    expect(isContractClosed("review")).toBe(false);
    expect(isContractClosed("ready")).toBe(false);
  });
});

describe("canTransitionContractStatus", () => {
  it("disallows transitioning to the same status", () => {
    expect(canTransitionContractStatus("draft", "draft")).toBe(false);
  });

  it("disallows any transition away from a locked status via the plain setter", () => {
    expect(canTransitionContractStatus("signed", "draft")).toBe(false);
    expect(canTransitionContractStatus("cancelled", "review")).toBe(false);
    expect(canTransitionContractStatus("archived", "ready")).toBe(false);
  });

  it("disallows transitioning directly into a locked status via the plain setter", () => {
    expect(canTransitionContractStatus("draft", "sent")).toBe(false);
    expect(canTransitionContractStatus("review", "signed")).toBe(false);
    expect(canTransitionContractStatus("draft", "completed")).toBe(false);
  });

  it("allows moving freely among draft/review/ready", () => {
    expect(canTransitionContractStatus("draft", "review")).toBe(true);
    expect(canTransitionContractStatus("review", "ready")).toBe(true);
    expect(canTransitionContractStatus("ready", "draft")).toBe(true);
  });
});

describe("getNextContractStatuses", () => {
  it("returns an empty list for every locked status", () => {
    for (const status of ["sent", "viewed", "signed", "completed", "expired", "cancelled", "archived", "declined"] as const) {
      expect(getNextContractStatuses(status)).toEqual([]);
    }
  });

  it("never includes the current status or a locked status", () => {
    const next = getNextContractStatuses("draft");
    expect(next).not.toContain("draft");
    expect(next).not.toContain("sent");
    expect(next).not.toContain("completed");
    expect(next.sort()).toEqual(["ready", "review"]);
  });
});

describe("getContractNextRecommendedAction", () => {
  it("returns null for every closed status", () => {
    for (const status of CLOSED_CONTRACT_STATUSES) {
      expect(getContractNextRecommendedAction({ status, total_value: 1000, expiration_date: null })).toBeNull();
    }
  });

  it("prompts to set a value before anything else in draft with no total_value", () => {
    expect(getContractNextRecommendedAction({ status: "draft", total_value: null, expiration_date: null })).toBe(
      "Set the contract value",
    );
  });

  it("prompts to move draft to review once a value is set", () => {
    expect(getContractNextRecommendedAction({ status: "draft", total_value: 1000, expiration_date: null })).toBe(
      "Complete the contract details and move it to review",
    );
  });

  it("has a distinct suggestion for review and ready", () => {
    expect(getContractNextRecommendedAction({ status: "review", total_value: 1000, expiration_date: null })).toBe(
      "Review the contract and mark it ready to send",
    );
    expect(getContractNextRecommendedAction({ status: "ready", total_value: 1000, expiration_date: null })).toBe(
      "Send the contract to the client",
    );
  });

  it("flags a sent contract past its expiration date instead of the ordinary follow-up message", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect(getContractNextRecommendedAction({ status: "sent", total_value: 1000, expiration_date: past })).toBe(
      "This contract has passed its expiration date — mark it expired",
    );
  });

  it("gives the ordinary follow-up message for a sent contract not yet expired", () => {
    expect(getContractNextRecommendedAction({ status: "sent", total_value: 1000, expiration_date: null })).toBe(
      "Follow up — the contract hasn't been viewed yet",
    );
  });

  it("has distinct suggestions for viewed and signed", () => {
    expect(getContractNextRecommendedAction({ status: "viewed", total_value: 1000, expiration_date: null })).toBe(
      "Follow up for signature",
    );
    expect(getContractNextRecommendedAction({ status: "signed", total_value: 1000, expiration_date: null })).toBe(
      "Mark the contract as completed",
    );
  });

  it("is deterministic for every status in CONTRACT_STATUSES", () => {
    for (const status of CONTRACT_STATUSES) {
      const contract = { status, total_value: 1000, expiration_date: null };
      expect(getContractNextRecommendedAction(contract)).toBe(getContractNextRecommendedAction(contract));
    }
  });
});
