import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 27.2 — Operational Timeline Engine. Pure mapping from
 * a plan lifecycle transition to the Timeline event it produces — mirrors
 * `allocationTimelineEngine.ts`'s shape exactly.
 * `operationalPlanningActions.ts` calls these only on a real transition,
 * never on every read/re-evaluation, same "avoid Timeline noise"
 * discipline.
 */
export interface OperationalTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function planCreatedEvent(planName: string): OperationalTimelineEvent {
  return { type: "plan_created", description: `Operational plan "${planName}" created.` };
}

export function planUpdatedEvent(planName: string): OperationalTimelineEvent {
  return { type: "plan_updated", description: `Operational plan "${planName}" updated.` };
}

export function planApprovedEvent(planName: string): OperationalTimelineEvent {
  return { type: "plan_approved", description: `Operational plan "${planName}" approved.` };
}

export function planArchivedEvent(planName: string): OperationalTimelineEvent {
  return { type: "plan_archived", description: `Operational plan "${planName}" archived.` };
}

export function phaseAddedEvent(phaseName: string): OperationalTimelineEvent {
  return { type: "phase_added", description: `Execution phase "${phaseName}" added.` };
}

export function stepAddedEvent(stepTitle: string): OperationalTimelineEvent {
  return { type: "step_added", description: `Execution step "${stepTitle}" added.` };
}

export function milestoneCompletedEvent(milestoneTitle: string): OperationalTimelineEvent {
  return { type: "milestone_completed", description: `Milestone "${milestoneTitle}" completed.` };
}

export function approvalRequiredEvent(approvalDescription: string): OperationalTimelineEvent {
  return { type: "approval_required", description: `Approval required: ${approvalDescription}` };
}

export function deliverableAddedEvent(deliverableTitle: string): OperationalTimelineEvent {
  return { type: "deliverable_added", description: `Deliverable "${deliverableTitle}" added.` };
}

export function evidenceRequirementAddedEvent(evidenceDescription: string): OperationalTimelineEvent {
  return { type: "evidence_requirement_added", description: `Evidence requirement added: ${evidenceDescription}` };
}
