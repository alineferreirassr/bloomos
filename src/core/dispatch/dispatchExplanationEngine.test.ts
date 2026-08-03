import { describe, expect, it } from "vitest";
import { explainDispatch } from "@/core/dispatch/dispatchExplanationEngine";
import type { DispatchAssignment, DispatchHealthScores, DispatchValidationResult } from "@/types/dispatch";

const PERFECT_HEALTH: DispatchHealthScores = { assignmentCoverage: 100, acceptanceRate: 100, declineRate: 0, queueHealth: 100, pendingCount: 0, dispatchReadiness: 100, overallDispatchHealth: 100 };

function makeAssignment(overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: "dispatch_assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "accepted", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

describe("explainDispatch", () => {
  it("summarizes a passing dispatch and lists accepted assignments under whySucceeded", () => {
    const validation: DispatchValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainDispatch(validation, PERFECT_HEALTH, [makeAssignment()]);
    expect(explanation.summary).toBe("Overall dispatch health 100/100.");
    expect(explanation.whyFailed).toHaveLength(0);
    expect(explanation.whySucceeded).toEqual(['worker "worker_1" accepted the assignment.']);
  });

  it("surfaces validation errors under whyFailed/validationFailures", () => {
    const validation: DispatchValidationResult = { valid: false, errors: [{ rule: "worker_inactive", detail: 'Worker "worker_1" is not active.' }], warnings: [] };
    const explanation = explainDispatch(validation, { ...PERFECT_HEALTH, dispatchReadiness: 0 }, [makeAssignment({ queue_state: "queued" })]);
    expect(explanation.whyFailed).toEqual(['Worker "worker_1" is not active.']);
    expect(explanation.validationFailures).toEqual(['Worker "worker_1" is not active.']);
    expect(explanation.summary).toContain("1 blocking issue");
  });

  it("surfaces declined/expired assignments under acceptanceFailures with their reason", () => {
    const validation: DispatchValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainDispatch(validation, PERFECT_HEALTH, [makeAssignment({ queue_state: "declined", reason: "Not available" })]);
    expect(explanation.acceptanceFailures).toEqual(['worker "worker_1" declined: Not available.']);
  });

  it("includes a queue status summary counting every named state", () => {
    const validation: DispatchValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainDispatch(validation, PERFECT_HEALTH, [makeAssignment({ queue_state: "queued" }), makeAssignment({ queue_state: "pending" })]);
    expect(explanation.queueStatus).toContain("1 queued");
    expect(explanation.queueStatus).toContain("1 pending");
  });
});
