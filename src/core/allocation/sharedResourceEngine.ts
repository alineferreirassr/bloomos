import type { ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 10 — Shared Resource Engine. A resource can
 * legitimately appear as a candidate in more than one active allocation
 * (a truck used for both a morning and an evening event) — this engine
 * only ever flags the invalid case: the *same* resource proposed across
 * two allocations whose required time windows genuinely overlap. Never
 * re-implements `ConflictEngine`/`ReservationEngine` (Checkpoint 27) —
 * those operate on real, persisted `Reservation`s; this operates on
 * still-proposed `Allocation` candidates, a stage earlier.
 */

export interface ResourceUsageWindow {
  resource_type: ResourceType;
  resource_id: string;
  allocation_id: string;
  starts_at: string;
  ends_at: string;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Every other allocation's usage of the same resource whose window genuinely overlaps the candidate's — the raw material an `AllocationFinding` of type `shared_resource_conflict` is built from. */
export function findSharedResourceConflicts(candidate: ResourceUsageWindow, others: ResourceUsageWindow[]): ResourceUsageWindow[] {
  return others.filter((o) => o.resource_type === candidate.resource_type && o.resource_id === candidate.resource_id && o.allocation_id !== candidate.allocation_id && overlaps(candidate.starts_at, candidate.ends_at, o.starts_at, o.ends_at));
}

/** `true` when a resource is proposed across more than one distinct allocation at all — regardless of whether their windows overlap. A shared-but-non-overlapping resource is fine; this flag alone doesn't mean invalid, it means "worth surfacing on the Resource Pool as shared." */
export function isResourceShared(resourceType: ResourceType, resourceId: string, allUsages: ResourceUsageWindow[]): boolean {
  const distinctAllocations = new Set(allUsages.filter((u) => u.resource_type === resourceType && u.resource_id === resourceId).map((u) => u.allocation_id));
  return distinctAllocations.size > 1;
}
