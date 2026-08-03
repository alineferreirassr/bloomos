import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 27.1 — Allocation Timeline Engine. Pure mapping from
 * an allocation lifecycle transition to the Timeline event it produces —
 * mirrors `schedulingTimelineEngine.ts`'s shape exactly.
 * `allocationActions.ts` calls these only on a real transition, never on
 * every read/re-evaluation, same "avoid Timeline noise" discipline.
 */
export interface AllocationTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function allocationCreatedEvent(strategyLabel: string): AllocationTimelineEvent {
  return { type: "allocation_created", description: `Allocation proposal created (${strategyLabel}).` };
}

export function allocationUpdatedEvent(): AllocationTimelineEvent {
  return { type: "allocation_updated", description: "Allocation candidates updated." };
}

export function allocationRecalculatedEvent(): AllocationTimelineEvent {
  return { type: "allocation_recalculated", description: "Allocation recalculated." };
}

export function allocationFallbackUsedEvent(resourceType: string, tier: number): AllocationTimelineEvent {
  return { type: "allocation_fallback_used", description: `A tier ${tier} ${resourceType} fallback was used.` };
}

export function allocationDependencyFailedEvent(ruleDescription: string): AllocationTimelineEvent {
  return { type: "allocation_dependency_failed", description: `Dependency not satisfied: ${ruleDescription}` };
}

export function allocationBundleCompletedEvent(bundleName: string): AllocationTimelineEvent {
  return { type: "allocation_bundle_completed", description: `Bundle "${bundleName}" fully satisfied.` };
}

export function allocationApprovedEvent(): AllocationTimelineEvent {
  return { type: "allocation_approved", description: "Allocation approved." };
}

export function allocationArchivedEvent(): AllocationTimelineEvent {
  return { type: "allocation_archived", description: "Allocation archived." };
}
