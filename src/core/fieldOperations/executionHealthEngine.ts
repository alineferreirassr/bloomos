import type { ExecutionValidationResult, ExecutionState, OperationalProgress, ExecutionOutcome, ExecutionLifecycleState, ExecutionHealthScores } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 6 — Execution Health Engine. 6 named scores,
 * every one a pure function over already-computed data — no live
 * lookups, no AI. `overallOperationalHealth` averages all 5 component
 * scores (unlike Dispatch's own health engine, none of these 5 are a
 * raw count or a duplicate-signal metric that needs excluding).
 */

/** Reflects whether this execution is currently valid to run — a direct read of `ExecutionValidationEngine`'s own `valid` flag, genuinely binary, no vacuous case needed. */
export function computeExecutionHealth(validationValid: boolean): number {
  return validationValid ? 100 : 0;
}

/** Averages the 4 named progress ratios (steps, milestones, checklist, deliverables) — vacuous-100 per ratio when there's nothing of that kind to track, the codebase-wide "no data yet is the good state" convention. */
export function computeProgressHealth(progress: OperationalProgress): number {
  const totalSteps = progress.completedStepIds.length + progress.remainingStepIds.length;
  const stepRatio = totalSteps === 0 ? 100 : Math.round((progress.completedStepIds.length / totalSteps) * 100);

  const totalMilestones = progress.completedMilestoneIds.length + progress.pendingMilestoneIds.length;
  const milestoneRatio = totalMilestones === 0 ? 100 : Math.round((progress.completedMilestoneIds.length / totalMilestones) * 100);

  return Math.round((stepRatio + milestoneRatio + progress.checklistProgress + progress.deliverableProgress) / 4);
}

/** A "badness" metric, the same asymmetric-vacuous discipline `computeDeclineRate` established for Dispatch: 100 (fully healthy) when no time has elapsed yet to measure against, degrading as the paused share of total elapsed time grows. */
export function computePauseHealth(state: ExecutionState): number {
  if (state.elapsedTimeSeconds <= 0) return 100;
  const pausedShare = Math.min(1, state.pauseDurationSeconds / state.elapsedTimeSeconds);
  return Math.round((1 - pausedShare) * 100);
}

/** `100` while no terminal outcome has happened yet — nothing bad has occurred, the vacuous-good case. Once terminal, binary: `100` for `"completed"`, `0` for `cancelled`/`aborted`/`failed`. */
export function computeCompletionHealth(outcome: ExecutionOutcome | null): number {
  if (outcome === null) return 100;
  return outcome === "completed" ? 100 : 0;
}

/** Reads the session's own current standing — a `paused` session is a caution (60), not a failure; an unresolved terminal outcome (cancelled/aborted/failed) is unhealthy even once archived, since archiving doesn't erase what happened. */
export function computeLifecycleHealth(lifecycleState: ExecutionLifecycleState, outcome: ExecutionOutcome | null): number {
  if (outcome !== null) return outcome === "completed" ? 100 : 0;
  return lifecycleState === "paused" ? 60 : 100;
}

export interface ComputeExecutionHealthInput {
  validation: ExecutionValidationResult;
  state: ExecutionState;
  progress: OperationalProgress;
  outcome: ExecutionOutcome | null;
  lifecycleState: ExecutionLifecycleState;
}

export function computeExecutionHealthScores(input: ComputeExecutionHealthInput): ExecutionHealthScores {
  const executionHealth = computeExecutionHealth(input.validation.valid);
  const progressHealth = computeProgressHealth(input.progress);
  const pauseHealth = computePauseHealth(input.state);
  const completionHealth = computeCompletionHealth(input.outcome);
  const lifecycleHealth = computeLifecycleHealth(input.lifecycleState, input.outcome);
  const overallOperationalHealth = Math.round((executionHealth + progressHealth + pauseHealth + completionHealth + lifecycleHealth) / 5);

  return { executionHealth, progressHealth, pauseHealth, completionHealth, lifecycleHealth, overallOperationalHealth };
}
