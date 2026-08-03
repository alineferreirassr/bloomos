import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 28 — Dispatch Timeline Engine. Pure mapping from a
 * dispatch lifecycle transition to the Timeline event it produces —
 * mirrors `executionPackageTimelineEngine.ts`'s shape exactly.
 * `dispatchActions.ts` calls these only on a real transition, never on
 * every read/re-evaluation, same "avoid Timeline noise" discipline
 * every prior checkpoint's Timeline integration follows.
 */
export interface DispatchTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function dispatchCreatedEvent(assignmentCount: number): DispatchTimelineEvent {
  return { type: "dispatch_created", description: `Dispatch order created with ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"}.` };
}

export function assignmentCreatedEvent(resourceType: string, resourceId: string): DispatchTimelineEvent {
  return { type: "dispatch_assignment_created", description: `Assignment created for ${resourceType} "${resourceId}".` };
}

export function assignmentAcceptedEvent(resourceType: string, resourceId: string): DispatchTimelineEvent {
  return { type: "assignment_accepted", description: `${resourceType} "${resourceId}" accepted the assignment.` };
}

export function assignmentDeclinedEvent(resourceType: string, resourceId: string, reason: string): DispatchTimelineEvent {
  return { type: "assignment_declined", description: `${resourceType} "${resourceId}" declined the assignment: ${reason}` };
}

export function dispatchCancelledEvent(): DispatchTimelineEvent {
  return { type: "dispatch_cancelled", description: "Dispatch order cancelled." };
}

export function dispatchArchivedEvent(): DispatchTimelineEvent {
  return { type: "dispatch_archived", description: "Dispatch order archived." };
}

export function queueUpdatedEvent(queueState: string): DispatchTimelineEvent {
  return { type: "queue_updated", description: `Dispatch queue updated — assignment now "${queueState.replace(/_/g, " ")}".` };
}
