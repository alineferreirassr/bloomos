import { describe, expect, it } from "vitest";
import { isTerminalQueueState, countByQueueState, findAssignmentsInState, isPastDeadline, isLegalQueueTransition } from "@/core/dispatch/dispatchQueueEngine";
import type { DispatchAssignment } from "@/types/dispatch";

function makeAssignment(overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: "dispatch_assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "queued", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

describe("isTerminalQueueState", () => {
  it("treats accepted/declined/cancelled/expired/completed_placeholder as terminal", () => {
    expect(isTerminalQueueState("accepted")).toBe(true);
    expect(isTerminalQueueState("declined")).toBe(true);
    expect(isTerminalQueueState("cancelled")).toBe(true);
    expect(isTerminalQueueState("expired")).toBe(true);
    expect(isTerminalQueueState("completed_placeholder")).toBe(true);
  });

  it("treats queued/assigned/pending as non-terminal", () => {
    expect(isTerminalQueueState("queued")).toBe(false);
    expect(isTerminalQueueState("assigned")).toBe(false);
    expect(isTerminalQueueState("pending")).toBe(false);
  });
});

describe("countByQueueState", () => {
  it("counts every named state, including zero-count states", () => {
    const counts = countByQueueState([makeAssignment({ queue_state: "queued" }), makeAssignment({ queue_state: "accepted" }), makeAssignment({ queue_state: "accepted" })]);
    expect(counts.queued).toBe(1);
    expect(counts.accepted).toBe(2);
    expect(counts.declined).toBe(0);
  });
});

describe("findAssignmentsInState", () => {
  it("filters to the requested state", () => {
    const assignments = [makeAssignment({ id: "a1", queue_state: "pending" }), makeAssignment({ id: "a2", queue_state: "accepted" })];
    expect(findAssignmentsInState(assignments, "pending").map((a) => a.id)).toEqual(["a1"]);
  });
});

describe("isPastDeadline", () => {
  it("is false for a terminal assignment regardless of expires_at", () => {
    const assignment = makeAssignment({ queue_state: "accepted", expires_at: "2025-01-01T00:00:00.000Z" });
    expect(isPastDeadline(assignment, "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("is false when there's no deadline set", () => {
    expect(isPastDeadline(makeAssignment({ expires_at: null }), "2026-01-01T00:00:00.000Z")).toBe(false);
  });

  it("is true for a non-terminal assignment whose deadline has passed", () => {
    const assignment = makeAssignment({ queue_state: "pending", expires_at: "2026-01-01T00:00:00.000Z" });
    expect(isPastDeadline(assignment, "2026-01-02T00:00:00.000Z")).toBe(true);
  });
});

describe("isLegalQueueTransition", () => {
  it("allows the real happy-path chain", () => {
    expect(isLegalQueueTransition("queued", "assigned")).toBe(true);
    expect(isLegalQueueTransition("assigned", "pending")).toBe(true);
    expect(isLegalQueueTransition("pending", "accepted")).toBe(true);
    expect(isLegalQueueTransition("pending", "declined")).toBe(true);
    expect(isLegalQueueTransition("pending", "expired")).toBe(true);
  });

  it("allows cancellation from any non-terminal state", () => {
    expect(isLegalQueueTransition("queued", "cancelled")).toBe(true);
    expect(isLegalQueueTransition("assigned", "cancelled")).toBe(true);
    expect(isLegalQueueTransition("pending", "cancelled")).toBe(true);
  });

  it("rejects a transition out of a terminal state", () => {
    expect(isLegalQueueTransition("accepted", "declined")).toBe(false);
    expect(isLegalQueueTransition("declined", "pending")).toBe(false);
  });

  it("rejects skipping states", () => {
    expect(isLegalQueueTransition("queued", "accepted")).toBe(false);
  });
});
