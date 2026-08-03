import type { Assignment, Equipment, Vehicle, Team } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1, Step 14 — Assignment Conflict Detection. Reuses
 * Checkpoint 26's Assignment Engine/store — this file detects conflicts
 * against already-recorded `Assignment` rows, it never schedules or
 * predicts one. No calendar, no time windows: without a scheduling
 * concept anywhere in this codebase, "conflict" here means exactly what
 * can be checked from current state — an existing active assignment to
 * the same target, or a shared piece of equipment/vehicle someone else
 * already holds.
 */

export interface AssignmentConflictResult {
  /** Worker already has an active Assignment to this exact `assignable_type`+`assignable_id` — assigning them again would be a duplicate, exclusive conflict. */
  hasDuplicateAssignment: boolean;
  conflictingAssignmentIds: string[];
  /** How many active assignments this worker currently holds — a capacity signal, not itself a block (this codebase has no configured per-worker assignment limit). */
  workerActiveAssignmentCount: number;
}

export function detectWorkerAssignmentConflict(workerId: string, assignableType: string, assignableId: string, assignments: Assignment[]): AssignmentConflictResult {
  const workerAssignments = assignments.filter((a) => a.worker_id === workerId && a.status === "active");
  const duplicates = workerAssignments.filter((a) => a.assignable_type === assignableType && a.assignable_id === assignableId);

  return {
    hasDuplicateAssignment: duplicates.length > 0,
    conflictingAssignmentIds: duplicates.map((a) => a.id),
    workerActiveAssignmentCount: workerAssignments.length,
  };
}

/** `assigned_worker_id` set to someone other than the evaluated worker means the resource is genuinely unavailable to them right now — a real conflict, not a soft preference. */
export function hasEquipmentConflict(equipment: Equipment, forWorkerId: string): boolean {
  return equipment.assigned_worker_id !== null && equipment.assigned_worker_id !== forWorkerId && equipment.status === "in_use";
}

export function hasVehicleConflict(vehicle: Vehicle, forWorkerId: string): boolean {
  return vehicle.assigned_worker_id !== null && vehicle.assigned_worker_id !== forWorkerId && vehicle.status === "in_use";
}

export interface TeamCapacityConflict {
  teamId: string;
  memberCount: number;
  /** Members with zero active assignments right now — the team's real, currently-idle capacity. */
  availableMemberCount: number;
}

export function evaluateTeamCapacity(team: Team, assignments: Assignment[]): TeamCapacityConflict {
  const activeAssignmentWorkerIds = new Set(assignments.filter((a) => a.status === "active").map((a) => a.worker_id));
  const availableMemberCount = team.member_worker_ids.filter((id) => !activeAssignmentWorkerIds.has(id)).length;
  return { teamId: team.id, memberCount: team.member_worker_ids.length, availableMemberCount };
}
