import { describe, expect, it } from "vitest";
import { evaluateAcceptDecision, evaluateDeclineDecision, evaluateTimeoutDecision, evaluateReassignmentPlaceholder } from "@/core/dispatch/acceptanceEngine";
import type { DispatchAssignment } from "@/types/dispatch";

function makeAssignment(overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: "dispatch_assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "pending", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

describe("evaluateAcceptDecision", () => {
  it("allows accepting a pending assignment", () => {
    const result = evaluateAcceptDecision(makeAssignment());
    expect(result).toEqual({ allowed: true, nextState: "accepted", error: null });
  });

  it("rejects accepting an already-terminal assignment", () => {
    const result = evaluateAcceptDecision(makeAssignment({ queue_state: "declined" }));
    expect(result.allowed).toBe(false);
  });
});

describe("evaluateDeclineDecision", () => {
  it("allows declining a pending assignment with a reason", () => {
    const result = evaluateDeclineDecision(makeAssignment(), "Not available that day.");
    expect(result).toEqual({ allowed: true, nextState: "declined", error: null });
  });

  it("rejects a blank reason", () => {
    const result = evaluateDeclineDecision(makeAssignment(), "  ");
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("reason is required");
  });
});

describe("evaluateTimeoutDecision", () => {
  it("allows expiring a pending assignment past its deadline", () => {
    const assignment = makeAssignment({ expires_at: "2026-01-01T00:00:00.000Z" });
    const result = evaluateTimeoutDecision(assignment, "2026-01-02T00:00:00.000Z");
    expect(result).toEqual({ allowed: true, nextState: "expired", error: null });
  });

  it("rejects expiring before the deadline", () => {
    const assignment = makeAssignment({ expires_at: "2026-01-02T00:00:00.000Z" });
    const result = evaluateTimeoutDecision(assignment, "2026-01-01T00:00:00.000Z");
    expect(result.allowed).toBe(false);
  });
});

describe("evaluateReassignmentPlaceholder", () => {
  it("is an honest, disclosed no-op", () => {
    expect(evaluateReassignmentPlaceholder().supported).toBe(false);
  });
});
