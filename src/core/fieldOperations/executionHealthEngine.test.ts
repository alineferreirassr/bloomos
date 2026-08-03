import { describe, expect, it } from "vitest";
import { computeExecutionHealth, computeProgressHealth, computePauseHealth, computeCompletionHealth, computeLifecycleHealth, computeExecutionHealthScores } from "@/core/fieldOperations/executionHealthEngine";
import type { ExecutionState, OperationalProgress, ExecutionValidationResult } from "@/types/fieldOperations";

function buildProgress(overrides: Partial<OperationalProgress> = {}): OperationalProgress {
  return { currentPhaseId: null, completedStepIds: [], remainingStepIds: [], completedMilestoneIds: [], pendingMilestoneIds: [], checklistProgress: 100, deliverableProgress: 100, evidenceProgressPlaceholder: null, ...overrides };
}

function buildState(overrides: Partial<ExecutionState> = {}): ExecutionState {
  return { currentState: "started", previousState: "created", transitionHistory: [], elapsedTimeSeconds: 100, pauseDurationSeconds: 0, executionDurationSeconds: 100, completionDurationSeconds: null, ...overrides };
}

describe("executionHealthEngine", () => {
  it("computeExecutionHealth is binary on validation.valid", () => {
    expect(computeExecutionHealth(true)).toBe(100);
    expect(computeExecutionHealth(false)).toBe(0);
  });

  it("computeProgressHealth is vacuous-100 with nothing to track", () => {
    expect(computeProgressHealth(buildProgress())).toBe(100);
  });

  it("computeProgressHealth averages step/milestone/checklist/deliverable ratios", () => {
    const progress = buildProgress({ completedStepIds: ["s1"], remainingStepIds: ["s2"], checklistProgress: 0, deliverableProgress: 0 });
    // step ratio 50, milestone ratio 100 (vacuous), checklist 0, deliverable 0 -> avg 37.5 -> 38
    expect(computeProgressHealth(progress)).toBe(38);
  });

  it("computePauseHealth is 100 with no elapsed time", () => {
    expect(computePauseHealth(buildState({ elapsedTimeSeconds: 0 }))).toBe(100);
  });

  it("computePauseHealth degrades as the paused share of elapsed time grows", () => {
    expect(computePauseHealth(buildState({ elapsedTimeSeconds: 100, pauseDurationSeconds: 50 }))).toBe(50);
    expect(computePauseHealth(buildState({ elapsedTimeSeconds: 100, pauseDurationSeconds: 0 }))).toBe(100);
  });

  it("computeCompletionHealth is vacuous-100 before any terminal outcome", () => {
    expect(computeCompletionHealth(null)).toBe(100);
  });

  it("computeCompletionHealth is binary once terminal", () => {
    expect(computeCompletionHealth("completed")).toBe(100);
    expect(computeCompletionHealth("failed")).toBe(0);
    expect(computeCompletionHealth("cancelled")).toBe(0);
    expect(computeCompletionHealth("aborted")).toBe(0);
  });

  it("computeLifecycleHealth treats paused as a caution, not a failure", () => {
    expect(computeLifecycleHealth("paused", null)).toBe(60);
    expect(computeLifecycleHealth("started", null)).toBe(100);
  });

  it("computeLifecycleHealth stays unhealthy after archiving a bad outcome", () => {
    expect(computeLifecycleHealth("archived", "failed")).toBe(0);
    expect(computeLifecycleHealth("archived", "completed")).toBe(100);
  });

  it("computeExecutionHealthScores composes all 5 into overallOperationalHealth", () => {
    const validation: ExecutionValidationResult = { valid: true, errors: [], warnings: [] };
    const scores = computeExecutionHealthScores({ validation, state: buildState(), progress: buildProgress(), outcome: null, lifecycleState: "started" });
    expect(scores.executionHealth).toBe(100);
    expect(scores.progressHealth).toBe(100);
    expect(scores.pauseHealth).toBe(100);
    expect(scores.completionHealth).toBe(100);
    expect(scores.lifecycleHealth).toBe(100);
    expect(scores.overallOperationalHealth).toBe(100);
  });
});
