import { countByQueueState } from "@/core/dispatch/dispatchQueueEngine";
import type { DispatchAssignment, DispatchExplanation, DispatchHealthScores, DispatchValidationResult } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28, Step 8 — Dispatch Explanation Engine. Turns an
 * already-validated, already-scored dispatch order into readable prose
 * — the same discipline `packageExplanationEngine.ts`/
 * `operationalExplanationEngine.ts` established: never expose a bare
 * health number or a raw assignment list without the reasoning behind it.
 */
export function explainDispatch(validation: DispatchValidationResult, health: DispatchHealthScores, assignments: DispatchAssignment[]): DispatchExplanation {
  const validationFailures = validation.errors.map((e) => e.detail);
  const acceptanceFailures = assignments.filter((a) => a.queue_state === "declined" || a.queue_state === "expired").map((a) => `${a.resource_type} "${a.resource_id}" ${a.queue_state}${a.reason ? `: ${a.reason}` : ""}.`);

  const whyFailed = validation.valid ? [] : validation.errors.map((e) => e.detail);
  const whySucceeded = validation.valid ? assignments.filter((a) => a.queue_state === "accepted").map((a) => `${a.resource_type} "${a.resource_id}" accepted the assignment.`) : [];

  const counts = countByQueueState(assignments);
  const queueStatus = `${counts.queued} queued, ${counts.assigned} assigned, ${counts.pending} pending, ${counts.accepted} accepted, ${counts.declined} declined, ${counts.expired} expired, ${counts.cancelled} cancelled.`;

  const dispatchReadinessSummary = `Dispatch readiness ${health.dispatchReadiness}/100${validation.valid ? "" : ` — blocked by ${validation.errors.length} validation issue${validation.errors.length === 1 ? "" : "s"}.`}`;

  const issueNote = validation.valid ? "" : ` (${validation.errors.length} blocking issue${validation.errors.length === 1 ? "" : "s"})`;
  const summary = `Overall dispatch health ${health.overallDispatchHealth}/100${issueNote}.`;

  return { summary, whyFailed, whySucceeded, validationFailures, acceptanceFailures, queueStatus, dispatchReadinessSummary };
}
