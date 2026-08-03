import type { ExecutionValidationResult, ExecutionHealthScores, ExecutionSession, OperationalProgress, ExecutionExplanation } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 7 — Execution Explanation Engine. Readable
 * prose over already-computed data — mirrors `packageExplanationEngine.ts`/
 * `dispatchExplanationEngine.ts`'s shape exactly. Detects nothing new;
 * every line traces back to a validation error, a session's own
 * `reason`, or the Operational Progress Engine's already-computed
 * remaining-work counts.
 */

export function explainExecution(validation: ExecutionValidationResult, health: ExecutionHealthScores, session: ExecutionSession, progress: OperationalProgress): ExecutionExplanation {
  // "Why execution cannot start" is only ever relevant before the session has actually started.
  const whyCannotStart = session.started_at === null ? validation.errors.map((e) => e.detail) : [];

  const whyPaused = session.lifecycle_state === "paused" && session.reason !== null ? [session.reason] : [];

  // Resume carries no domain reason of its own (only Cancel/Abort/Fail require one) — a fixed, honest description instead of a fabricated cause.
  const whyResumed = session.lifecycle_state === "resumed" ? ["Execution resumed after a pause."] : [];

  const whyFailed = session.lifecycle_state === "failed" && session.reason !== null ? [session.reason] : [];

  const isActive = session.lifecycle_state === "started" || session.lifecycle_state === "paused" || session.lifecycle_state === "resumed";
  const whyCompletionRejected: string[] = [];
  if (isActive) {
    if (progress.remainingStepIds.length > 0) whyCompletionRejected.push(`${progress.remainingStepIds.length} step(s) remaining.`);
    if (progress.pendingMilestoneIds.length > 0) whyCompletionRejected.push(`${progress.pendingMilestoneIds.length} milestone(s) pending.`);
    if (progress.checklistProgress < 100) whyCompletionRejected.push(`Checklist ${progress.checklistProgress}% complete.`);
    if (progress.deliverableProgress < 100) whyCompletionRejected.push(`Deliverables ${progress.deliverableProgress}% complete.`);
  }

  const healthSummary = `Overall operational health ${health.overallOperationalHealth}/100.`;
  const summary = `Execution session is "${session.lifecycle_state}" — ${healthSummary}`;

  return { summary, whyCannotStart, whyPaused, whyResumed, whyFailed, whyCompletionRejected, healthSummary };
}
