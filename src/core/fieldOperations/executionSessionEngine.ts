import { EXECUTION_LIFECYCLE_STATES, type ExecutionLifecycleState, type ExecutionSession, type ExecutionValidationResult } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 3 — Execution Session Engine. Pure transition
 * rules and the spec's own 7 named session actions — mirrors Dispatch's
 * combined `dispatchQueueEngine.ts`/`acceptanceEngine.ts` shape exactly:
 * one disclosed `LEGAL_TRANSITIONS` map every decision function is
 * checked against, never a second, duplicate state machine.
 *
 * Real precedence: `created` (session opened) → `waiting` (validated,
 * queued to start) → `started` → `paused` ⇄ `resumed` → one of
 * `completed`/`cancelled`/`aborted`/`failed` (an outcome-bearing
 * terminal) → `archived` (filed away). `cancelled` is reachable from any
 * non-terminal, pre-completion state; `aborted`/`failed` only from an
 * active state (`started`/`paused`/`resumed`) — a session that never
 * started has nothing to abort or fail.
 */

const TERMINAL_STATES: ReadonlySet<ExecutionLifecycleState> = new Set(["completed", "cancelled", "aborted", "failed", "archived"]);

export function isTerminalLifecycleState(state: ExecutionLifecycleState): boolean {
  return TERMINAL_STATES.has(state);
}

const LEGAL_TRANSITIONS: Record<ExecutionLifecycleState, readonly ExecutionLifecycleState[]> = {
  created: ["waiting", "started", "cancelled"],
  waiting: ["started", "cancelled"],
  started: ["paused", "completed", "cancelled", "aborted", "failed"],
  paused: ["resumed", "cancelled", "aborted", "failed"],
  resumed: ["paused", "completed", "cancelled", "aborted", "failed"],
  completed: ["archived"],
  cancelled: ["archived"],
  aborted: ["archived"],
  failed: ["archived"],
  archived: [],
};

/** Nothing is legal out of `archived` — a filed-away session stays that way; a fresh `ExecutionSession` (via `startNewSession`) is how work resumes after a terminal outcome, never a transition out of one. */
export function isLegalLifecycleTransition(from: ExecutionLifecycleState, to: ExecutionLifecycleState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function countByLifecycleState(sessions: ExecutionSession[]): Record<ExecutionLifecycleState, number> {
  const counts = Object.fromEntries(EXECUTION_LIFECYCLE_STATES.map((s) => [s, 0])) as Record<ExecutionLifecycleState, number>;
  for (const session of sessions) counts[session.lifecycle_state]++;
  return counts;
}

export function findSessionsInState(sessions: ExecutionSession[], state: ExecutionLifecycleState): ExecutionSession[] {
  return sessions.filter((s) => s.lifecycle_state === state);
}

export interface SessionDecisionResult {
  allowed: boolean;
  nextState: ExecutionLifecycleState | null;
  error: string | null;
}

function evaluateTransition(session: ExecutionSession, nextState: ExecutionLifecycleState): SessionDecisionResult {
  if (!isLegalLifecycleTransition(session.lifecycle_state, nextState)) {
    return { allowed: false, nextState: null, error: `Cannot transition from "${session.lifecycle_state}" to "${nextState}".` };
  }
  return { allowed: true, nextState, error: null };
}

/** Start additionally requires the Execution Validation Engine's own already-computed result to be valid — "Reject invalid execution attempts" (Step 4's own line), never re-implemented here. */
export function evaluateStartDecision(session: ExecutionSession, validation: ExecutionValidationResult): SessionDecisionResult {
  if (!validation.valid) return { allowed: false, nextState: null, error: validation.errors[0]?.detail ?? "This execution cannot start." };
  return evaluateTransition(session, "started");
}

export function evaluatePauseDecision(session: ExecutionSession): SessionDecisionResult {
  return evaluateTransition(session, "paused");
}

export function evaluateResumeDecision(session: ExecutionSession): SessionDecisionResult {
  return evaluateTransition(session, "resumed");
}

/** Completion may be rejected for a domain reason even when the lifecycle transition is otherwise legal — `requiredWorkComplete` is resolved by the caller from `OperationalProgressEngine`'s own output, never re-derived here. */
export function evaluateCompleteDecision(session: ExecutionSession, requiredWorkComplete: boolean): SessionDecisionResult {
  if (!requiredWorkComplete) return { allowed: false, nextState: null, error: "Required steps, milestones, or checklist items are not yet complete." };
  return evaluateTransition(session, "completed");
}

/** A cancel always carries a `reason` — an audit trail entry, never a bare boolean with no explanation. */
export function evaluateCancelDecision(session: ExecutionSession, reason: string): SessionDecisionResult {
  if (!reason.trim()) return { allowed: false, nextState: null, error: "A cancellation reason is required." };
  return evaluateTransition(session, "cancelled");
}

export function evaluateAbortDecision(session: ExecutionSession, reason: string): SessionDecisionResult {
  if (!reason.trim()) return { allowed: false, nextState: null, error: "An abort reason is required." };
  return evaluateTransition(session, "aborted");
}

/**
 * Disclosed addition — Step 3's own "Support" list names 7 actions, but
 * Step 2 requires all 10 lifecycle states to have "deterministic
 * transitions," including `failed`. A session can fail during active
 * work (an execution-side problem distinct from a deliberate
 * cancel/abort), so this engine exposes the same reachability
 * `aborted` has — from any active state, never from `created`/`waiting`.
 */
export function evaluateFailDecision(session: ExecutionSession, reason: string): SessionDecisionResult {
  if (!reason.trim()) return { allowed: false, nextState: null, error: "A failure reason is required." };
  return evaluateTransition(session, "failed");
}

export function evaluateArchiveDecision(session: ExecutionSession): SessionDecisionResult {
  return evaluateTransition(session, "archived");
}
