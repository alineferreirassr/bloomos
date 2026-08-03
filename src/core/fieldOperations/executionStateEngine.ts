import type { ExecutionSession, ExecutionState, ExecutionLifecycleState } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 5 — Execution State Engine. Pure derivations
 * over a session's own `attempts[]` transition log and its own
 * timestamp fields — never a live clock dependency inside the engine
 * itself; `now` is always supplied by the caller (the same "pure engine
 * takes its timestamp from the caller" discipline `SnapshotEngine`/
 * `isPastDeadline` established before it).
 */

function diffSeconds(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000);
}

/** `null` when no transition has happened yet (still `created`, zero attempts); `"created"` when exactly one transition has happened (the implicit starting state); otherwise the state two entries back in the attempt log. */
function derivePreviousState(session: ExecutionSession): ExecutionLifecycleState | null {
  if (session.attempts.length === 0) return null;
  if (session.attempts.length === 1) return "created";
  return session.attempts[session.attempts.length - 2].lifecycle_state;
}

/** Sums every `paused → (resumed | terminal)` interval in the attempt log, plus an open-ended pause still in progress at `now`. Handles any number of pause/resume cycles, not just one. */
function computePauseDuration(session: ExecutionSession, now: string): number {
  let total = 0;
  let pauseStart: string | null = null;
  for (const attempt of session.attempts) {
    if (attempt.lifecycle_state === "paused") {
      pauseStart = attempt.created_at;
    } else if (pauseStart !== null) {
      total += diffSeconds(pauseStart, attempt.created_at);
      pauseStart = null;
    }
  }
  if (pauseStart !== null) total += diffSeconds(pauseStart, now);
  return total;
}

export function computeExecutionState(session: ExecutionSession, now: string): ExecutionState {
  const pauseDurationSeconds = computePauseDuration(session, now);
  const elapsedTimeSeconds = diffSeconds(session.created_at, session.completed_at ?? now);
  const executionDurationSeconds = session.started_at === null ? 0 : Math.max(0, diffSeconds(session.started_at, session.completed_at ?? now) - pauseDurationSeconds);
  const completionDurationSeconds = session.completed_at === null ? null : diffSeconds(session.created_at, session.completed_at);

  return {
    currentState: session.lifecycle_state,
    previousState: derivePreviousState(session),
    transitionHistory: session.attempts,
    elapsedTimeSeconds,
    pauseDurationSeconds,
    executionDurationSeconds,
    completionDurationSeconds,
  };
}
