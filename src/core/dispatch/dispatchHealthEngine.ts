import type { DispatchAssignment, DispatchHealthScores } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28, Step 7 — Dispatch Health Engine. Seven disclosed,
 * deterministic formulas over an order's own `assignments[]` — same
 * "not applicable resolves to a vacuous pass" discipline every score
 * engine in this codebase follows, with one deliberate asymmetric
 * exception: `declineRate`'s vacuous value is `0` (no signal yet is a
 * good state for a "bad" metric), not `100` like every other score here.
 */

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

const TERMINAL_RESPONSE_STATES = new Set(["accepted", "declined", "expired"]);

export function computeAssignmentCoverage(assignments: DispatchAssignment[]): number {
  if (assignments.length === 0) return 100;
  const accepted = assignments.filter((a) => a.queue_state === "accepted").length;
  return clampScore((100 * accepted) / assignments.length);
}

export function computeAcceptanceRate(assignments: DispatchAssignment[]): number {
  const terminal = assignments.filter((a) => TERMINAL_RESPONSE_STATES.has(a.queue_state));
  if (terminal.length === 0) return 100;
  const accepted = terminal.filter((a) => a.queue_state === "accepted").length;
  return clampScore((100 * accepted) / terminal.length);
}

/** Vacuous `0` — not `100` — for zero terminal responses: "no declines yet" is the good state for this metric, the opposite of every other vacuous-100 score here. */
export function computeDeclineRate(assignments: DispatchAssignment[]): number {
  const terminal = assignments.filter((a) => TERMINAL_RESPONSE_STATES.has(a.queue_state));
  if (terminal.length === 0) return 0;
  const declined = terminal.filter((a) => a.queue_state === "declined").length;
  return clampScore((100 * declined) / terminal.length);
}

export function computeQueueHealth(assignments: DispatchAssignment[]): number {
  if (assignments.length === 0) return 100;
  const moved = assignments.filter((a) => a.queue_state !== "queued").length;
  return clampScore((100 * moved) / assignments.length);
}

export function computePendingCount(assignments: DispatchAssignment[]): number {
  return assignments.filter((a) => a.queue_state === "pending").length;
}

/** A direct, binary reflection of `DispatchValidationEngine`'s own `valid` flag — genuinely binary, not a ratio, so there's no vacuous case to disclose. */
export function computeDispatchReadiness(validationValid: boolean): number {
  return validationValid ? 100 : 0;
}

function computeOverallDispatchHealth(scores: { assignmentCoverage: number; acceptanceRate: number; queueHealth: number; dispatchReadiness: number }): number {
  const values = Object.values(scores);
  return clampScore(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeDispatchHealthScores(assignments: DispatchAssignment[], validationValid: boolean): DispatchHealthScores {
  const assignmentCoverage = computeAssignmentCoverage(assignments);
  const acceptanceRate = computeAcceptanceRate(assignments);
  const declineRate = computeDeclineRate(assignments);
  const queueHealth = computeQueueHealth(assignments);
  const pendingCount = computePendingCount(assignments);
  const dispatchReadiness = computeDispatchReadiness(validationValid);
  const overallDispatchHealth = computeOverallDispatchHealth({ assignmentCoverage, acceptanceRate, queueHealth, dispatchReadiness });

  return { assignmentCoverage, acceptanceRate, declineRate, queueHealth, pendingCount, dispatchReadiness, overallDispatchHealth };
}
