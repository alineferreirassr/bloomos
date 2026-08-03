import { describe, expect, it } from "vitest";
import {
  isTerminalLifecycleState,
  isLegalLifecycleTransition,
  countByLifecycleState,
  findSessionsInState,
  evaluateStartDecision,
  evaluatePauseDecision,
  evaluateResumeDecision,
  evaluateCompleteDecision,
  evaluateCancelDecision,
  evaluateAbortDecision,
  evaluateFailDecision,
  evaluateArchiveDecision,
} from "@/core/fieldOperations/executionSessionEngine";
import type { ExecutionSession, ExecutionLifecycleState, ExecutionValidationResult } from "@/types/fieldOperations";

function buildSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return {
    id: "session_1",
    field_operation_id: "field_operation_1",
    lifecycle_state: "created",
    outcome: null,
    reason: null,
    current_phase_id: null,
    completed_step_ids: [],
    completed_milestone_ids: [],
    completed_checklist_item_ids: [],
    completed_deliverable_ids: [],
    started_at: null,
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

describe("executionSessionEngine — lifecycle rules", () => {
  it("treats completed/cancelled/aborted/failed/archived as terminal", () => {
    (["completed", "cancelled", "aborted", "failed", "archived"] as ExecutionLifecycleState[]).forEach((s) => expect(isTerminalLifecycleState(s)).toBe(true));
  });

  it("treats created/waiting/started/paused/resumed as non-terminal", () => {
    (["created", "waiting", "started", "paused", "resumed"] as ExecutionLifecycleState[]).forEach((s) => expect(isTerminalLifecycleState(s)).toBe(false));
  });

  it("allows the real happy-path chain", () => {
    expect(isLegalLifecycleTransition("created", "started")).toBe(true);
    expect(isLegalLifecycleTransition("started", "paused")).toBe(true);
    expect(isLegalLifecycleTransition("paused", "resumed")).toBe(true);
    expect(isLegalLifecycleTransition("resumed", "completed")).toBe(true);
    expect(isLegalLifecycleTransition("completed", "archived")).toBe(true);
  });

  it("allows cancellation from created/waiting/started/paused/resumed", () => {
    (["created", "waiting", "started", "paused", "resumed"] as ExecutionLifecycleState[]).forEach((s) => expect(isLegalLifecycleTransition(s, "cancelled")).toBe(true));
  });

  it("only allows abort/fail from an active state, never from created/waiting", () => {
    expect(isLegalLifecycleTransition("created", "aborted")).toBe(false);
    expect(isLegalLifecycleTransition("waiting", "failed")).toBe(false);
    expect(isLegalLifecycleTransition("started", "aborted")).toBe(true);
    expect(isLegalLifecycleTransition("paused", "failed")).toBe(true);
  });

  it("rejects a transition out of a terminal-with-outcome state except to archived", () => {
    expect(isLegalLifecycleTransition("completed", "started")).toBe(false);
    expect(isLegalLifecycleTransition("cancelled", "started")).toBe(false);
  });

  it("rejects anything out of archived", () => {
    expect(isLegalLifecycleTransition("archived", "started")).toBe(false);
    expect(isLegalLifecycleTransition("archived", "archived")).toBe(false);
  });

  it("counts every named state, including zero-count states", () => {
    const counts = countByLifecycleState([buildSession({ lifecycle_state: "started" }), buildSession({ lifecycle_state: "started" })]);
    expect(counts.started).toBe(2);
    expect(counts.paused).toBe(0);
    expect(counts.archived).toBe(0);
  });

  it("filters to the requested state", () => {
    const sessions = [buildSession({ id: "s1", lifecycle_state: "started" }), buildSession({ id: "s2", lifecycle_state: "paused" })];
    expect(findSessionsInState(sessions, "paused").map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("executionSessionEngine — the 7 named decisions", () => {
  it("Start: allowed from created when validation passes", () => {
    expect(evaluateStartDecision(buildSession({ lifecycle_state: "created" }), VALID).allowed).toBe(true);
  });

  it("Start: rejected when validation fails, even though the transition itself would be legal", () => {
    const result = evaluateStartDecision(buildSession({ lifecycle_state: "created" }), INVALID);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("No worker is assigned");
  });

  it("Pause: allowed from started", () => {
    expect(evaluatePauseDecision(buildSession({ lifecycle_state: "started" })).allowed).toBe(true);
  });

  it("Pause: rejected from created", () => {
    expect(evaluatePauseDecision(buildSession({ lifecycle_state: "created" })).allowed).toBe(false);
  });

  it("Resume: allowed from paused", () => {
    expect(evaluateResumeDecision(buildSession({ lifecycle_state: "paused" })).allowed).toBe(true);
  });

  it("Complete: rejected when required work isn't done, even from a legal state", () => {
    const result = evaluateCompleteDecision(buildSession({ lifecycle_state: "started" }), false);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain("not yet complete");
  });

  it("Complete: allowed from started when required work is done", () => {
    expect(evaluateCompleteDecision(buildSession({ lifecycle_state: "started" }), true).allowed).toBe(true);
  });

  it("Cancel: requires a non-blank reason", () => {
    expect(evaluateCancelDecision(buildSession({ lifecycle_state: "created" }), "").allowed).toBe(false);
    expect(evaluateCancelDecision(buildSession({ lifecycle_state: "created" }), "Client rescheduled").allowed).toBe(true);
  });

  it("Abort: requires a reason and only applies to active sessions", () => {
    expect(evaluateAbortDecision(buildSession({ lifecycle_state: "created" }), "Emergency").allowed).toBe(false);
    expect(evaluateAbortDecision(buildSession({ lifecycle_state: "started" }), "Emergency").allowed).toBe(true);
  });

  it("Fail: requires a reason and only applies to active sessions", () => {
    expect(evaluateFailDecision(buildSession({ lifecycle_state: "waiting" }), "Equipment broke").allowed).toBe(false);
    expect(evaluateFailDecision(buildSession({ lifecycle_state: "resumed" }), "Equipment broke").allowed).toBe(true);
  });

  it("Archive: allowed from any terminal-with-outcome state", () => {
    expect(evaluateArchiveDecision(buildSession({ lifecycle_state: "completed" })).allowed).toBe(true);
    expect(evaluateArchiveDecision(buildSession({ lifecycle_state: "failed" })).allowed).toBe(true);
  });

  it("Archive: rejected from an active state", () => {
    expect(evaluateArchiveDecision(buildSession({ lifecycle_state: "started" })).allowed).toBe(false);
  });
});
