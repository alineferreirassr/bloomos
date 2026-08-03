import { DISPATCH_QUEUE_STATES, type DispatchQueueState, type DispatchAssignment } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28, Step 5 — Dispatch Queue. Pure reads and transition
 * rules over a `DispatchAssignment`'s own `queue_state` — the 8 named
 * states the spec calls for. Real precedence: `queued` (created) →
 * `assigned` (locked to its resource) → `pending` (presented, awaiting a
 * response) → one of `accepted`/`declined`/`expired` (terminal); `cancelled`
 * is reachable from any non-terminal state. `completed_placeholder` is
 * reserved — no transition in this engine or checkpoint ever reaches it,
 * since the Stop Condition forbids executing work.
 */

const TERMINAL_STATES: ReadonlySet<DispatchQueueState> = new Set(["accepted", "declined", "cancelled", "expired", "completed_placeholder"]);

export function isTerminalQueueState(state: DispatchQueueState): boolean {
  return TERMINAL_STATES.has(state);
}

export function countByQueueState(assignments: DispatchAssignment[]): Record<DispatchQueueState, number> {
  const counts = Object.fromEntries(DISPATCH_QUEUE_STATES.map((s) => [s, 0])) as Record<DispatchQueueState, number>;
  for (const assignment of assignments) counts[assignment.queue_state]++;
  return counts;
}

export function findAssignmentsInState(assignments: DispatchAssignment[], state: DispatchQueueState): DispatchAssignment[] {
  return assignments.filter((a) => a.queue_state === state);
}

/** A disclosed timeout check only — it never auto-transitions anything. The caller decides whether/when to act on a past-due assignment. */
export function isPastDeadline(assignment: DispatchAssignment, now: string): boolean {
  if (isTerminalQueueState(assignment.queue_state)) return false;
  if (assignment.expires_at === null) return false;
  return new Date(assignment.expires_at).getTime() < new Date(now).getTime();
}

const LEGAL_TRANSITIONS: Record<DispatchQueueState, readonly DispatchQueueState[]> = {
  queued: ["assigned", "cancelled"],
  assigned: ["pending", "cancelled"],
  pending: ["accepted", "declined", "expired", "cancelled"],
  accepted: [],
  declined: [],
  cancelled: [],
  expired: [],
  completed_placeholder: [],
};

/** Nothing is legal out of a terminal state — an accepted/declined/cancelled/expired assignment stays that way; reassignment (a fresh attempt with a different resource) is the spec's own disclosed "Reassignment Placeholder," not a queue-state transition. */
export function isLegalQueueTransition(from: DispatchQueueState, to: DispatchQueueState): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
