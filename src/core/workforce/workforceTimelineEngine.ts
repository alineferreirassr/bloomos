import type { WorkerStatus, AvailabilityStatus, TeamStatus, EquipmentStatus, VehicleStatus } from "@/types/workforce";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 26 — Workforce Timeline Engine. Pure mapping from a
 * lifecycle transition to the Timeline event it produces — no data
 * access, mirrors `objectiveTimelineEngine.ts`'s shape exactly.
 * `workforceActions.ts` calls these and feeds the result straight into
 * `recordTimelineActivity`.
 */

export interface WorkforceTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function workerCreatedEvent(workerName: string): WorkforceTimelineEvent {
  return { type: "worker_created", description: `Worker "${workerName}" added.` };
}

export function workerUpdatedEvent(workerName: string): WorkforceTimelineEvent {
  return { type: "worker_updated", description: `Worker "${workerName}" profile updated.` };
}

export function workerStatusChangedEvent(workerName: string, previousStatus: WorkerStatus, nextStatus: WorkerStatus): WorkforceTimelineEvent {
  if (nextStatus === "terminated") return { type: "worker_archived", description: `Worker "${workerName}" archived.` };
  if (previousStatus === "terminated" && nextStatus === "active") return { type: "worker_restored", description: `Worker "${workerName}" restored.` };
  return { type: "worker_status_changed", description: `Worker "${workerName}" status changed from ${previousStatus} to ${nextStatus}.` };
}

export function workerAvailabilityChangedEvent(workerName: string, status: AvailabilityStatus): WorkforceTimelineEvent {
  return { type: "worker_availability_changed", description: `Worker "${workerName}" availability set to ${status.replace(/_/g, " ")}.` };
}

export function teamCreatedEvent(teamName: string): WorkforceTimelineEvent {
  return { type: "team_created", description: `Team "${teamName}" created.` };
}

export function teamUpdatedEvent(teamName: string): WorkforceTimelineEvent {
  return { type: "team_updated", description: `Team "${teamName}" updated.` };
}

export function teamStatusEvent(teamName: string, status: TeamStatus): WorkforceTimelineEvent | null {
  if (status !== "archived") return null;
  return { type: "team_archived", description: `Team "${teamName}" archived.` };
}

export function workerAddedToTeamEvent(workerName: string, teamName: string): WorkforceTimelineEvent {
  return { type: "worker_added_to_team", description: `Worker "${workerName}" added to team "${teamName}".` };
}

export function workerRemovedFromTeamEvent(workerName: string, teamName: string): WorkforceTimelineEvent {
  return { type: "worker_removed_from_team", description: `Worker "${workerName}" removed from team "${teamName}".` };
}

export function assignmentCreatedEvent(workerName: string, assignableLabel: string): WorkforceTimelineEvent {
  return { type: "assignment_created", description: `Worker "${workerName}" assigned to ${assignableLabel}.` };
}

export function assignmentEndedEvent(workerName: string, assignableLabel: string, status: "completed" | "cancelled"): WorkforceTimelineEvent {
  if (status === "cancelled") return { type: "assignment_cancelled", description: `Worker "${workerName}"'s assignment to ${assignableLabel} was cancelled.` };
  return { type: "assignment_ended", description: `Worker "${workerName}"'s assignment to ${assignableLabel} completed.` };
}

export function equipmentCreatedEvent(equipmentName: string): WorkforceTimelineEvent {
  return { type: "equipment_created", description: `Equipment "${equipmentName}" registered.` };
}

export function equipmentStatusChangedEvent(equipmentName: string, status: EquipmentStatus): WorkforceTimelineEvent {
  return { type: "equipment_status_changed", description: `Equipment "${equipmentName}" status changed to ${status.replace(/_/g, " ")}.` };
}

export function equipmentAssignedEvent(equipmentName: string, workerName: string | null): WorkforceTimelineEvent {
  return { type: "equipment_assigned", description: workerName ? `Equipment "${equipmentName}" assigned to "${workerName}".` : `Equipment "${equipmentName}" unassigned.` };
}

export function vehicleCreatedEvent(vehicleLabel: string): WorkforceTimelineEvent {
  return { type: "vehicle_created", description: `Vehicle "${vehicleLabel}" registered.` };
}

export function vehicleStatusChangedEvent(vehicleLabel: string, status: VehicleStatus): WorkforceTimelineEvent {
  return { type: "vehicle_status_changed", description: `Vehicle "${vehicleLabel}" status changed to ${status.replace(/_/g, " ")}.` };
}

export function vehicleAssignedEvent(vehicleLabel: string, workerName: string | null): WorkforceTimelineEvent {
  return { type: "vehicle_assigned", description: workerName ? `Vehicle "${vehicleLabel}" assigned to "${workerName}".` : `Vehicle "${vehicleLabel}" unassigned.` };
}

export function mobileSessionStartedEvent(workerName: string, deviceLabel: string): WorkforceTimelineEvent {
  return { type: "mobile_session_started", description: `Worker "${workerName}" started a mobile session on ${deviceLabel}.` };
}

export function mobileSessionEndedEvent(workerName: string, deviceLabel: string): WorkforceTimelineEvent {
  return { type: "mobile_session_ended", description: `Worker "${workerName}"'s mobile session on ${deviceLabel} ended.` };
}
