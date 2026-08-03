import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 29 — Execution Timeline Engine. Pure mapping from a
 * session lifecycle transition to the Timeline event it produces —
 * mirrors `dispatchTimelineEngine.ts`'s shape exactly. `fieldOperationsActions.ts`
 * calls these only on a real transition, never on every read/re-evaluation,
 * the same "avoid Timeline noise" discipline every prior checkpoint's
 * Timeline integration follows.
 */
export interface ExecutionTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function executionStartedEvent(): ExecutionTimelineEvent {
  return { type: "execution_started", description: "Execution started." };
}

export function executionPausedEvent(reason: string | null): ExecutionTimelineEvent {
  return { type: "execution_paused", description: reason !== null ? `Execution paused: ${reason}` : "Execution paused." };
}

export function executionResumedEvent(): ExecutionTimelineEvent {
  return { type: "execution_resumed", description: "Execution resumed." };
}

export function executionCompletedEvent(): ExecutionTimelineEvent {
  return { type: "execution_completed", description: "Execution completed." };
}

export function executionCancelledEvent(reason: string): ExecutionTimelineEvent {
  return { type: "execution_cancelled", description: `Execution cancelled: ${reason}` };
}

export function executionFailedEvent(reason: string): ExecutionTimelineEvent {
  return { type: "execution_failed", description: `Execution failed: ${reason}` };
}

export function executionArchivedEvent(): ExecutionTimelineEvent {
  return { type: "execution_archived", description: "Execution archived." };
}
