import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { EligibilityState } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1 — Capability Timeline Engine. Pure mapping from a
 * lifecycle/evaluation transition to the Timeline event it produces —
 * mirrors `workforceTimelineEngine.ts`'s shape exactly. `capabilityActions.ts`
 * calls these only when a real transition happened (per "avoid Timeline
 * noise" — see `capabilityEvaluationSnapshotsStore.ts`), never on every
 * re-evaluation unconditionally.
 */
export interface CapabilityTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function requirementCreatedEvent(title: string): CapabilityTimelineEvent {
  return { type: "capability_requirement_created", description: `Capability requirement "${title}" created.` };
}

export function requirementUpdatedEvent(title: string): CapabilityTimelineEvent {
  return { type: "capability_requirement_updated", description: `Capability requirement "${title}" updated.` };
}

export function requirementArchivedEvent(title: string): CapabilityTimelineEvent {
  return { type: "capability_requirement_archived", description: `Capability requirement "${title}" archived.` };
}

/** `previousState: null` means this is the worker's first evaluation against this requirement. */
export function stateTransitionEvent(workerName: string, requirementTitle: string, previousState: EligibilityState | null, nextState: EligibilityState): CapabilityTimelineEvent {
  if (nextState === "eligible") return { type: "worker_became_eligible", description: `${workerName} became eligible for "${requirementTitle}".` };
  if (nextState === "ineligible") return { type: "worker_became_ineligible", description: `${workerName} became ineligible for "${requirementTitle}".` };
  if (nextState === "conditionally_eligible") return { type: "worker_became_conditionally_eligible", description: `${workerName} became conditionally eligible for "${requirementTitle}".` };
  return { type: "worker_evaluated", description: `${workerName} was evaluated against "${requirementTitle}" — result unknown.` };
}

export function scoreChangedEvent(workerName: string, requirementTitle: string, previousScore: number, nextScore: number): CapabilityTimelineEvent {
  return { type: "capability_score_changed", description: `${workerName}'s capability score for "${requirementTitle}" changed from ${previousScore} to ${nextScore}.` };
}

export function certificationExpiredEvent(workerName: string, certificationName: string): CapabilityTimelineEvent {
  return { type: "certification_became_expired", description: `${workerName}'s "${certificationName}" certification expired.` };
}

export function blockerDetectedEvent(workerName: string, requirementTitle: string, blockerDetail: string): CapabilityTimelineEvent {
  return { type: "capability_blocker_detected", description: `${workerName} is blocked from "${requirementTitle}": ${blockerDetail}` };
}
