import type { AllocationCandidate, ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 28, Step 3 — Assignment Engine. Assigns Workers,
 * Teams, Vehicles, Equipment, and Vendors — but only ever by carrying
 * forward the frozen Execution Package's own selected resources.
 * "Assignments must use the frozen Execution Package. No recalculation"
 * (the spec's own Step 3 lines) means this engine never re-evaluates
 * capability, availability, or allocation strategy — it reads
 * `ExecutionSnapshot.allocation_candidates` (already-frozen at Execution
 * Package build time) and produces one assignment seed per candidate
 * with `selected: true`, unchanged.
 */

export interface DispatchAssignmentSeed {
  resource_type: ResourceType;
  resource_id: string;
  requirement_line_index: number;
}

export function buildDispatchAssignments(candidates: AllocationCandidate[]): DispatchAssignmentSeed[] {
  return candidates.filter((c) => c.selected).map((c) => ({ resource_type: c.resource_type, resource_id: c.resource_id, requirement_line_index: c.requirement_line_index }));
}
