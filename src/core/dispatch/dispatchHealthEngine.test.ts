import { describe, expect, it } from "vitest";
import { computeAssignmentCoverage, computeAcceptanceRate, computeDeclineRate, computeQueueHealth, computePendingCount, computeDispatchReadiness, computeDispatchHealthScores } from "@/core/dispatch/dispatchHealthEngine";
import type { DispatchAssignment, DispatchQueueState } from "@/types/dispatch";

function makeAssignment(queue_state: DispatchQueueState, overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: `assignment_${Math.random()}`, order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state, reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

describe("computeAssignmentCoverage", () => {
  it("is vacuous 100 for zero assignments", () => {
    expect(computeAssignmentCoverage([])).toBe(100);
  });

  it("is the accepted ratio otherwise", () => {
    expect(computeAssignmentCoverage([makeAssignment("accepted"), makeAssignment("pending")])).toBe(50);
  });
});

describe("computeAcceptanceRate / computeDeclineRate", () => {
  it("are vacuous 100/0 respectively for zero terminal responses", () => {
    expect(computeAcceptanceRate([makeAssignment("queued")])).toBe(100);
    expect(computeDeclineRate([makeAssignment("queued")])).toBe(0);
  });

  it("compute ratios over terminal responses only, ignoring still-open assignments", () => {
    const assignments = [makeAssignment("accepted"), makeAssignment("declined"), makeAssignment("queued")];
    expect(computeAcceptanceRate(assignments)).toBe(50);
    expect(computeDeclineRate(assignments)).toBe(50);
  });
});

describe("computeQueueHealth", () => {
  it("is vacuous 100 for zero assignments", () => {
    expect(computeQueueHealth([])).toBe(100);
  });

  it("is the ratio of assignments that have moved past queued", () => {
    expect(computeQueueHealth([makeAssignment("queued"), makeAssignment("assigned")])).toBe(50);
  });
});

describe("computePendingCount", () => {
  it("counts only pending assignments", () => {
    expect(computePendingCount([makeAssignment("pending"), makeAssignment("pending"), makeAssignment("accepted")])).toBe(2);
  });
});

describe("computeDispatchReadiness", () => {
  it("is a direct binary reflection of validation validity", () => {
    expect(computeDispatchReadiness(true)).toBe(100);
    expect(computeDispatchReadiness(false)).toBe(0);
  });
});

describe("computeDispatchHealthScores", () => {
  it("returns overallDispatchHealth as the average of coverage/acceptance/queue/readiness, excluding declineRate and pendingCount", () => {
    const health = computeDispatchHealthScores([makeAssignment("accepted")], true);
    expect(health.overallDispatchHealth).toBe(100);
    expect(health.pendingCount).toBe(0);
  });
});
