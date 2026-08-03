import { describe, expect, it } from "vitest";
import { detectFieldOperationRisks, type FieldOperationRiskInput } from "@/core/fieldOperations/fieldOperationRiskEngine";
import type { ExecutionSession, ExecutionValidationResult, ExecutionHealthScores, ExecutionState } from "@/types/fieldOperations";

function buildSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "session_1",
    field_operation_id: "field_operation_1",
    lifecycle_state: "started",
    outcome: null,
    reason: null,
    current_phase_id: null,
    completed_step_ids: [],
    completed_milestone_ids: [],
    completed_checklist_item_ids: [],
    completed_deliverable_ids: [],
    started_at: "2026-01-01T00:00:00.000Z",
    paused_at: null,
    resumed_at: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    attempts: [],
    ...overrides,
  };
}

const VALID: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
const INVALID: ExecutionValidationResult = { valid: false, errors: [{ rule: "worker_not_assigned", detail: "No worker is assigned." }], warnings: [] };

function buildHealth(overrides: Partial<ExecutionHealthScores> = {}): ExecutionHealthScores {
  return { executionHealth: 100, progressHealth: 100, pauseHealth: 100, completionHealth: 100, lifecycleHealth: 100, overallOperationalHealth: 100, ...overrides };
}

function buildState(overrides: Partial<ExecutionState> = {}): ExecutionState {
  return { currentState: "started", previousState: "created", transitionHistory: [], elapsedTimeSeconds: 100, pauseDurationSeconds: 0, executionDurationSeconds: 100, completionDurationSeconds: null, ...overrides };
}

function buildInput(overrides: Partial<FieldOperationRiskInput> = {}): FieldOperationRiskInput {
  return { fieldOperationId: "field_operation_1", session: buildSession(), validation: VALID, health: buildHealth(), state: buildState(), estimatedDurationSeconds: 0, ...overrides };
}

describe("fieldOperationRiskEngine", () => {
  it("flags execution_blocked when validation fails", () => {
    const findings = detectFieldOperationRisks([buildInput({ validation: INVALID })]);
    expect(findings.some((f) => f.type === "execution_blocked" && f.severity === "high")).toBe(true);
  });

  it("flags execution_paused when the session is paused", () => {
    const findings = detectFieldOperationRisks([buildInput({ session: buildSession({ lifecycle_state: "paused" }) })]);
    expect(findings.some((f) => f.type === "execution_paused")).toBe(true);
  });

  it("flags execution_failed with the session's own reason", () => {
    const findings = detectFieldOperationRisks([buildInput({ session: buildSession({ lifecycle_state: "failed", outcome: "failed", reason: "Equipment malfunction" }) })]);
    const failed = findings.find((f) => f.type === "execution_failed");
    expect(failed?.description).toContain("Equipment malfunction");
  });

  it("flags execution_healthy when valid and above the health threshold", () => {
    const findings = detectFieldOperationRisks([buildInput()]);
    expect(findings.some((f) => f.type === "execution_healthy")).toBe(true);
  });

  it("flags execution_completed on a completed outcome", () => {
    const findings = detectFieldOperationRisks([buildInput({ session: buildSession({ lifecycle_state: "completed", outcome: "completed" }) })]);
    expect(findings.some((f) => f.type === "execution_completed")).toBe(true);
  });

  it("flags execution_delayed when pause health is low", () => {
    const findings = detectFieldOperationRisks([buildInput({ health: buildHealth({ pauseHealth: 40, overallOperationalHealth: 60 }) })]);
    expect(findings.some((f) => f.type === "execution_delayed")).toBe(true);
  });

  it("flags operational_delay when execution time significantly exceeds the plan's own estimate", () => {
    const findings = detectFieldOperationRisks([buildInput({ state: buildState({ executionDurationSeconds: 200 }), estimatedDurationSeconds: 100 })]);
    expect(findings.some((f) => f.type === "operational_delay")).toBe(true);
  });

  it("does not flag operational_delay within a reasonable overrun", () => {
    const findings = detectFieldOperationRisks([buildInput({ state: buildState({ executionDurationSeconds: 110 }), estimatedDurationSeconds: 100 })]);
    expect(findings.some((f) => f.type === "operational_delay")).toBe(false);
  });

  it("returns no findings for a clean, healthy, mid-execution session with no estimate to compare against", () => {
    const findings = detectFieldOperationRisks([buildInput()]);
    expect(findings.filter((f) => f.type === "execution_blocked" || f.type === "execution_paused" || f.type === "execution_failed" || f.type === "execution_delayed" || f.type === "operational_delay")).toHaveLength(0);
  });
});
