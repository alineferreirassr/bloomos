import { isLegalQueueTransition, isPastDeadline } from "@/core/dispatch/dispatchQueueEngine";
import type { DispatchAssignment, DispatchQueueState } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28, Step 6 — Acceptance Engine. Accept/Decline/Timeout
 * — three named decisions, each validated against `DispatchQueueEngine`'s
 * own legal-transition rules rather than a second, duplicate state
 * machine. "No notifications" (the spec's own Step 6 line) means this
 * file — and this checkpoint — never calls into the Communication
 * Platform; a decision is recorded, nothing is sent.
 */

export interface AcceptanceDecisionResult {
  allowed: boolean;
  nextState: DispatchQueueState | null;
  error: string | null;
}

function evaluateTransition(assignment: DispatchAssignment, nextState: DispatchQueueState): AcceptanceDecisionResult {
  if (!isLegalQueueTransition(assignment.queue_state, nextState)) {
    return { allowed: false, nextState: null, error: `Cannot transition from "${assignment.queue_state}" to "${nextState}".` };
  }
  return { allowed: true, nextState, error: null };
}

export function evaluateAcceptDecision(assignment: DispatchAssignment): AcceptanceDecisionResult {
  return evaluateTransition(assignment, "accepted");
}

/** A decline always carries a `reason` — the spec's own "Reason" line — never a bare boolean with no explanation. */
export function evaluateDeclineDecision(assignment: DispatchAssignment, reason: string): AcceptanceDecisionResult {
  if (!reason.trim()) return { allowed: false, nextState: null, error: "A decline reason is required." };
  return evaluateTransition(assignment, "declined");
}

export function evaluateTimeoutDecision(assignment: DispatchAssignment, now: string): AcceptanceDecisionResult {
  if (!isPastDeadline(assignment, now)) return { allowed: false, nextState: null, error: "This assignment hasn't passed its deadline yet." };
  return evaluateTransition(assignment, "expired");
}

/**
 * Disclosed placeholder — the spec names "Reassignment Placeholder" as
 * one of Step 6's own support items. No code path in this checkpoint
 * creates a fresh attempt for a declined/expired assignment against a
 * different resource; reassignment would mean re-selecting a candidate,
 * which is Resource Allocation's job, not Dispatch's. Reserved for a
 * future checkpoint, not silently omitted.
 */
export function evaluateReassignmentPlaceholder(): { supported: false; reason: string } {
  return { supported: false, reason: "Reassignment is not implemented in this checkpoint — reserved for a future Dispatch enhancement." };
}
