import type { DecisionPriority, DecisionStatus } from "@/types/executiveDecisions";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 25.7, Step 9 — Executive Timeline Engine. Pure mapping
 * from a status or priority transition to the Timeline event it produces
 * — no data access, no detection, same shape as `objectiveTimelineEngine.ts`
 * (Step 15.6) one layer down the stack.
 */

export interface DecisionTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

/** `previousStatus: null` means the Decision is being created for the first time. */
export function decisionStatusTimelineEvent(previousStatus: DecisionStatus | null, nextStatus: DecisionStatus, decisionTitle: string): DecisionTimelineEvent {
  if (previousStatus === null) {
    return { type: "decision_created", description: `Decision "${decisionTitle}" created.` };
  }
  if (previousStatus === nextStatus) {
    return { type: "decision_updated", description: `Decision "${decisionTitle}" updated.` };
  }
  if (nextStatus === "archived") {
    return { type: "decision_archived", description: `Decision "${decisionTitle}" archived.` };
  }
  if (nextStatus === "resolved") {
    return { type: "decision_resolved", description: `Decision "${decisionTitle}" resolved.` };
  }
  if (nextStatus === "escalated") {
    return { type: "decision_escalated", description: `Decision "${decisionTitle}" escalated.` };
  }
  // Any other transition into an open state (open/in_progress) from resolved/escalated/archived is a reopening.
  return { type: "decision_reopened", description: `Decision "${decisionTitle}" reopened.` };
}

/** Returns `null` when the priority hasn't actually changed — the caller should only record a Timeline entry when this returns an event. */
export function decisionPriorityTimelineEvent(previousPriority: DecisionPriority, nextPriority: DecisionPriority, decisionTitle: string): DecisionTimelineEvent | null {
  if (previousPriority === nextPriority) return null;
  return { type: "decision_priority_changed", description: `Decision "${decisionTitle}" priority changed from ${previousPriority} to ${nextPriority}.` };
}
