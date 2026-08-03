import { describe, expect, it } from "vitest";
import { detectDispatchRisks } from "@/core/dispatch/dispatchRiskEngine";
import type { DispatchOrderResult, DispatchOrder, DispatchAssignment, DispatchValidationResult, DispatchHealthScores } from "@/types/dispatch";

function buildAssignment(overrides: Partial<DispatchAssignment>): DispatchAssignment {
  return {
    id: "assignment_1",
    order_id: "order_1",
    resource_type: "worker",
    resource_id: "worker_1",
    requirement_line_index: 0,
    queue_state: "queued",
    reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    responded_at: null,
    expires_at: null,
    attempts: [],
    ...overrides,
  };
}

function buildOrder(assignments: DispatchAssignment[]): DispatchOrder {
  return {
    id: "order_1",
    workspace_id: "ws_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    batch_id: null,
    status: "dispatched",
    priority: "medium",
    source: "execution_package_derived",
    assignments,
    created_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    cancelled_at: null,
    archived_at: null,
  };
}

function buildValidation(valid: boolean): DispatchValidationResult {
  return { valid, errors: valid ? [] : [{ rule: "no_assignments", detail: "No assignments." }], warnings: [] };
}

function buildHealth(overrides: Partial<DispatchHealthScores>): DispatchHealthScores {
  return {
    assignmentCoverage: 100,
    acceptanceRate: 100,
    declineRate: 0,
    queueHealth: 100,
    pendingCount: 0,
    dispatchReadiness: 100,
    overallDispatchHealth: 100,
    ...overrides,
  };
}

describe("dispatchRiskEngine", () => {
  it("flags dispatch_blocked when validation fails", () => {
    const result: DispatchOrderResult = { order: buildOrder([]), validation: buildValidation(false), health: buildHealth({}), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.some((f) => f.type === "dispatch_blocked" && f.severity === "high")).toBe(true);
  });

  it("flags dispatch_ready when valid and fully ready", () => {
    const result: DispatchOrderResult = { order: buildOrder([]), validation: buildValidation(true), health: buildHealth({}), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.some((f) => f.type === "dispatch_ready")).toBe(true);
  });

  it("flags low_acceptance_rate below threshold", () => {
    const result: DispatchOrderResult = { order: buildOrder([]), validation: buildValidation(true), health: buildHealth({ acceptanceRate: 40, dispatchReadiness: 0 }), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.some((f) => f.type === "low_acceptance_rate")).toBe(true);
  });

  it("flags queue_congestion below threshold", () => {
    const result: DispatchOrderResult = { order: buildOrder([]), validation: buildValidation(true), health: buildHealth({ queueHealth: 30, pendingCount: 5, dispatchReadiness: 0 }), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.some((f) => f.type === "queue_congestion")).toBe(true);
  });

  it("flags assignment_failure for expired assignments", () => {
    const order = buildOrder([buildAssignment({ queue_state: "expired" })]);
    const result: DispatchOrderResult = { order, validation: buildValidation(true), health: buildHealth({}), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.some((f) => f.type === "assignment_failure")).toBe(true);
  });

  it("flags resource_rejected for declined assignments and includes the reason", () => {
    const order = buildOrder([buildAssignment({ queue_state: "declined", reason: "Not available" })]);
    const result: DispatchOrderResult = { order, validation: buildValidation(true), health: buildHealth({}), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    const rejected = findings.find((f) => f.type === "resource_rejected");
    expect(rejected?.description).toContain("Not available");
  });

  it("returns no findings for a clean, fully accepted order", () => {
    const order = buildOrder([buildAssignment({ queue_state: "accepted" })]);
    const result: DispatchOrderResult = { order, validation: buildValidation(true), health: buildHealth({}), explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } };
    const findings = detectDispatchRisks([result]);
    expect(findings.filter((f) => f.type === "assignment_failure" || f.type === "resource_rejected")).toHaveLength(0);
  });
});
