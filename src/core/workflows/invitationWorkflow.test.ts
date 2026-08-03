import { describe, expect, it } from "vitest";
import {
  canTransitionInvitationStatus,
  isInvitationTerminal,
  getInvitationNextRecommendedAction,
} from "@/core/workflows/invitationWorkflow";

describe("canTransitionInvitationStatus", () => {
  it("allows pending to move to accepted/expired/revoked", () => {
    expect(canTransitionInvitationStatus("pending", "accepted")).toBe(true);
    expect(canTransitionInvitationStatus("pending", "expired")).toBe(true);
    expect(canTransitionInvitationStatus("pending", "revoked")).toBe(true);
  });

  it("rejects any transition from a terminal status", () => {
    expect(canTransitionInvitationStatus("accepted", "pending")).toBe(false);
    expect(canTransitionInvitationStatus("expired", "pending")).toBe(false);
    expect(canTransitionInvitationStatus("revoked", "pending")).toBe(false);
  });

  it("rejects a same-status transition", () => {
    expect(canTransitionInvitationStatus("pending", "pending")).toBe(false);
  });
});

describe("isInvitationTerminal", () => {
  it("is false only for pending", () => {
    expect(isInvitationTerminal("pending")).toBe(false);
    expect(isInvitationTerminal("accepted")).toBe(true);
    expect(isInvitationTerminal("expired")).toBe(true);
    expect(isInvitationTerminal("revoked")).toBe(true);
  });
});

describe("getInvitationNextRecommendedAction", () => {
  it("returns null for a non-pending invitation", () => {
    expect(getInvitationNextRecommendedAction({ status: "accepted", expires_at: "2027-01-01T00:00:00.000Z" })).toBeNull();
  });

  it("recommends resending an already-expired pending invitation", () => {
    const action = getInvitationNextRecommendedAction({ status: "pending", expires_at: "2020-01-01T00:00:00.000Z" });
    expect(action).toMatch(/expired/i);
  });

  it("recommends resending a pending invitation expiring within 3 days", () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const action = getInvitationNextRecommendedAction({ status: "pending", expires_at: soon });
    expect(action).toMatch(/expires soon/i);
  });

  it("returns null for a pending invitation with plenty of time left", () => {
    const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(getInvitationNextRecommendedAction({ status: "pending", expires_at: later })).toBeNull();
  });
});
