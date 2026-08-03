import { describe, expect, it } from "vitest";
import { explainExecution } from "@/core/fieldOperations/executionExplanationEngine";
import type { ExecutionSession, ExecutionValidationResult, ExecutionHealthScores, OperationalProgress } from "@/types/fieldOperations";

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

const HEALTHY: ExecutionHealthScores = { executionHealth: 100, progressHealth: 100, pauseHealth: 100, completionHealth: 100, lifecycleHealth: 100, overallOperationalHealth: 100 };

function buildProgress(overrides: Partial<OperationalProgress> = {}): OperationalProgress {
  return { currentPhaseId: null, completedStepIds: [], remainingStepIds: [], completedMilestoneIds: [], pendingMilestoneIds: [], checklistProgress: 100, deliverableProgress: 100, evidenceProgressPlaceholder: null, ...overrides };
}

describe("executionExplanationEngine", () => {
  it("surfaces validation errors as whyCannotStart before the session has started", () => {
    const validation: ExecutionValidationResult = { valid: false, errors: [{ rule: "worker_not_assigned", detail: "No worker is assigned." }], warnings: [] };
    const explanation = explainExecution(validation, HEALTHY, buildSession(), buildProgress());
    expect(explanation.whyCannotStart).toEqual(["No worker is assigned."]);
  });

  it("clears whyCannotStart once the session has actually started, even if validation later fails", () => {
    const validation: ExecutionValidationResult = { valid: false, errors: [{ rule: "assignment_inactive", detail: "The assignment is no longer active." }], warnings: [] };
    const session = buildSession({ lifecycle_state: "started", started_at: "2026-01-01T00:01:00.000Z" });
    expect(explainExecution(validation, HEALTHY, session, buildProgress()).whyCannotStart).toEqual([]);
  });

  it("surfaces the session's own reason for whyPaused", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const session = buildSession({ lifecycle_state: "paused", reason: "Weather delay" });
    expect(explainExecution(validation, HEALTHY, session, buildProgress()).whyPaused).toEqual(["Weather delay"]);
  });

  it("gives a fixed description for whyResumed since resume carries no domain reason", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const session = buildSession({ lifecycle_state: "resumed" });
    expect(explainExecution(validation, HEALTHY, session, buildProgress()).whyResumed).toEqual(["Execution resumed after a pause."]);
  });

  it("surfaces the session's own reason for whyFailed", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const session = buildSession({ lifecycle_state: "failed", reason: "Equipment malfunction" });
    expect(explainExecution(validation, HEALTHY, session, buildProgress()).whyFailed).toEqual(["Equipment malfunction"]);
  });

  it("lists remaining work as whyCompletionRejected for an active session", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const session = buildSession({ lifecycle_state: "started", started_at: "2026-01-01T00:01:00.000Z" });
    const progress = buildProgress({ remainingStepIds: ["s1", "s2"], pendingMilestoneIds: ["m1"], checklistProgress: 50, deliverableProgress: 0 });
    const explanation = explainExecution(validation, HEALTHY, session, progress);
    expect(explanation.whyCompletionRejected).toEqual(["2 step(s) remaining.", "1 milestone(s) pending.", "Checklist 50% complete.", "Deliverables 0% complete."]);
  });

  it("has no completion-rejection reasons once nothing remains", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const session = buildSession({ lifecycle_state: "started", started_at: "2026-01-01T00:01:00.000Z" });
    expect(explainExecution(validation, HEALTHY, session, buildProgress()).whyCompletionRejected).toEqual([]);
  });

  it("includes an overall health summary", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainExecution(validation, HEALTHY, buildSession(), buildProgress());
    expect(explanation.healthSummary).toBe("Overall operational health 100/100.");
  });
});
