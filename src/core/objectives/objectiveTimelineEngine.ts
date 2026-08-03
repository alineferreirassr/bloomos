import type { ObjectiveStatus } from "@/types/objectives";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Objective Timeline Engine. Pure mapping
 * from a status transition to the Timeline event it produces — no data
 * access, no detection. `objectivesActions.ts` calls this once per
 * transition and feeds the result straight into `recordTimelineActivity`.
 */

export interface ObjectiveTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

/** `previousStatus: null` means the objective is being created for the first time. */
export function objectiveTimelineEventForTransition(previousStatus: ObjectiveStatus | null, nextStatus: ObjectiveStatus, objectiveTitle: string): ObjectiveTimelineEvent {
  if (previousStatus === null) {
    return { type: "objective_created", description: `Objective "${objectiveTitle}" created.` };
  }
  if (previousStatus === nextStatus) {
    return { type: "objective_updated", description: `Objective "${objectiveTitle}" updated.` };
  }
  if (nextStatus === "archived") {
    return { type: "objective_archived", description: `Objective "${objectiveTitle}" archived.` };
  }
  if (nextStatus === "blocked") {
    return { type: "objective_blocked", description: `Objective "${objectiveTitle}" blocked.` };
  }
  if (nextStatus === "completed") {
    return { type: "objective_completed", description: `Objective "${objectiveTitle}" completed.` };
  }
  if (nextStatus === "in_progress" && previousStatus === "not_started") {
    return { type: "objective_started", description: `Objective "${objectiveTitle}" started.` };
  }
  // Any other transition into an open state (in_progress/not_started) from blocked/completed/archived is a reopening.
  return { type: "objective_reopened", description: `Objective "${objectiveTitle}" reopened.` };
}
