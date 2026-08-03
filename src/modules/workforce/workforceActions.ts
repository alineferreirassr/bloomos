"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getCoreWorkersService,
  getCoreTeamsService,
  getCoreAvailabilityService,
  getCoreAssignmentsService,
  getCoreMobileSessionsService,
  getCoreOfflineQueueService,
  getCoreLocationService,
  getCoreEquipmentService,
  getCoreVehiclesService,
  type CreateWorkerInput,
  type CreateTeamInput,
  type CreateAssignmentInput,
  type StartMobileSessionInput,
  type QueueOfflineEntryInput,
  type RecordLocationInput,
  type CreateEquipmentInput,
  type CreateVehicleInput,
} from "@/core/workforce";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getClients, getEvents, getVendors } from "@/lib/data";
import { readMediaAssets } from "@/lib/data/mock/mediaAssetsStore";
import { nowIso } from "@/lib/data/utils";
import { resolveCurrentAvailability, computeAvailabilitySummary } from "@/core/workforce/availabilityEngine";
import { findExpiringCertifications } from "@/core/workforce/skillsEngine";
import { resolveAssignableNodeType } from "@/core/workforce/assignmentEngine";
import { deriveSessionStatus } from "@/core/workforce/mobileSessionEngine";
import { computeEquipmentUtilization, type EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import { computeVehicleUtilization, type VehicleUtilization } from "@/core/workforce/vehicleEngine";
import { computeWorkforceScorecard } from "@/core/workforce/workforceScorecardEngine";
import {
  workerCreatedEvent,
  workerUpdatedEvent,
  workerStatusChangedEvent,
  workerAvailabilityChangedEvent,
  teamCreatedEvent,
  teamUpdatedEvent,
  teamStatusEvent,
  workerAddedToTeamEvent,
  workerRemovedFromTeamEvent,
  assignmentCreatedEvent,
  assignmentEndedEvent,
  equipmentCreatedEvent,
  equipmentStatusChangedEvent,
  equipmentAssignedEvent,
  vehicleCreatedEvent,
  vehicleStatusChangedEvent,
  vehicleAssignedEvent,
  mobileSessionStartedEvent,
  mobileSessionEndedEvent,
} from "@/core/workforce/workforceTimelineEngine";
import type {
  Worker,
  WorkerStatus,
  Team,
  TeamStatus,
  Assignment,
  AssignableType,
  AssignmentStatus,
  AvailabilityStatus,
  AvailabilityWindow,
  MobileSession,
  OfflineQueueEntry,
  LocationSnapshot,
  Equipment,
  EquipmentStatus,
  Vehicle,
  VehicleStatus,
  WorkforceScorecard,
  ExpiringCertification,
} from "@/types/workforce";

const GENERIC_ACCESS_ERROR = "The workforce platform isn't available. You may not have access to it.";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function workerFullName(worker: Pick<Worker, "first_name" | "last_name">): string {
  return `${worker.first_name} ${worker.last_name}`;
}

/**
 * Best-effort label for an Assignment's `assignable_type`/`assignable_id`
 * — resolved from whichever repository actually owns that entity. Falls
 * back to a plain `"type:id"` string rather than guessing, honest about
 * what's known. `project`/`task_placeholder` always fall back — neither
 * has a real backing entity in this codebase.
 */
async function resolveAssignableLabel(workspaceId: string, assignableType: AssignableType, assignableId: string): Promise<string> {
  switch (assignableType) {
    case "client": {
      const clients = await getClients({});
      const client = clients.find((c) => c.id === assignableId);
      return client ? `Client "${client.first_name} ${client.last_name}"` : `client:${assignableId}`;
    }
    case "event": {
      const events = await getEvents({ includeArchived: true });
      const event = events.find((e) => e.id === assignableId);
      return event ? `Event "${event.title}"` : `event:${assignableId}`;
    }
    case "vendor": {
      const vendors = await getVendors({});
      const vendor = vendors.find((v) => v.id === assignableId);
      return vendor ? `Vendor "${vendor.company_name}"` : `vendor:${assignableId}`;
    }
    case "asset": {
      const asset = readMediaAssets().find((a) => a.id === assignableId && a.workspace_id === workspaceId);
      return asset ? `Asset "${asset.original_filename}"` : `asset:${assignableId}`;
    }
    case "vehicle": {
      const vehicle = await getCoreVehiclesService().getVehicleById(assignableId);
      return vehicle ? `Vehicle "${vehicle.label}"` : `vehicle:${assignableId}`;
    }
    case "equipment": {
      const equipment = await getCoreEquipmentService().getEquipmentById(assignableId);
      return equipment ? `Equipment "${equipment.name}"` : `equipment:${assignableId}`;
    }
    case "project":
    case "task_placeholder":
      return `${assignableType}:${assignableId}`;
  }
}

export async function createWorkerAction(input: CreateWorkerInput): Promise<ActionResult<Worker>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreWorkersService().createWorker(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = workerCreatedEvent(workerFullName(result.data));
  recordTimelineActivity(session.workspace.id, "worker", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function listWorkersAction(includeArchived = false): Promise<ActionResult<Worker[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workers = await getCoreWorkersService().listWorkersForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: workers };
}

export async function updateWorkerAction(
  workerId: string,
  input: Parameters<ReturnType<typeof getCoreWorkersService>["updateWorker"]>[2],
): Promise<ActionResult<Worker>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreWorkersService().updateWorker(workerId, session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = workerUpdatedEvent(workerFullName(result.data));
  recordTimelineActivity(session.workspace.id, "worker", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function setWorkerStatusAction(workerId: string, status: WorkerStatus): Promise<ActionResult<Worker>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const existing = await getCoreWorkersService().getWorkerById(workerId);
  if (!existing || existing.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const result = status === "terminated" ? await getCoreWorkersService().archiveWorker(workerId, session.workspace.id) : await getCoreWorkersService().setWorkerStatus(workerId, session.workspace.id, status);
  if (!result.success) return { success: false, error: result.error };

  const event = workerStatusChangedEvent(workerFullName(result.data), existing.status, result.data.status);
  recordTimelineActivity(session.workspace.id, "worker", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function setWorkerAvailabilityAction(
  workerId: string,
  status: AvailabilityStatus,
  startsAt: string,
  endsAt: string | null,
  note: string | null,
): Promise<ActionResult<AvailabilityWindow>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const worker = await getCoreWorkersService().getWorkerById(workerId);
  if (!worker || worker.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const result = await getCoreAvailabilityService().recordAvailabilityWindow(session.workspace.id, { worker_id: workerId, status, starts_at: startsAt, ends_at: endsAt, note, time_zone: worker.time_zone });
  if (!result.success) return { success: false, error: result.error };

  const event = workerAvailabilityChangedEvent(workerFullName(worker), status);
  recordTimelineActivity(session.workspace.id, "worker", workerId, event.type, event.description);

  return { success: true, data: result.data };
}

export async function createTeamAction(input: CreateTeamInput): Promise<ActionResult<Team>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreTeamsService().createTeam(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = teamCreatedEvent(result.data.name);
  recordTimelineActivity(session.workspace.id, "team", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function listTeamsAction(includeArchived = false): Promise<ActionResult<Team[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const teams = await getCoreTeamsService().listTeamsForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: teams };
}

export async function addWorkerToTeamAction(teamId: string, workerId: string): Promise<ActionResult<Team>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const worker = await getCoreWorkersService().getWorkerById(workerId);
  if (!worker || worker.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const result = await getCoreTeamsService().addMemberToTeam(teamId, session.workspace.id, workerId);
  if (!result.success) return { success: false, error: result.error };

  await getCoreWorkersService().updateWorker(workerId, session.workspace.id, { team_id: teamId });

  const event = workerAddedToTeamEvent(workerFullName(worker), result.data.name);
  recordTimelineActivity(session.workspace.id, "team", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function removeWorkerFromTeamAction(teamId: string, workerId: string): Promise<ActionResult<Team>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const worker = await getCoreWorkersService().getWorkerById(workerId);
  if (!worker || worker.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const result = await getCoreTeamsService().removeMemberFromTeam(teamId, session.workspace.id, workerId);
  if (!result.success) return { success: false, error: result.error };

  await getCoreWorkersService().updateWorker(workerId, session.workspace.id, { team_id: null });

  const event = workerRemovedFromTeamEvent(workerFullName(worker), result.data.name);
  recordTimelineActivity(session.workspace.id, "team", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function setTeamStatusAction(teamId: string, status: TeamStatus): Promise<ActionResult<Team>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreTeamsService().setTeamStatus(teamId, session.workspace.id, status);
  if (!result.success) return { success: false, error: result.error };

  const archivedEvent = teamStatusEvent(result.data.name, status);
  const event = archivedEvent ?? teamUpdatedEvent(result.data.name);
  recordTimelineActivity(session.workspace.id, "team", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function createAssignmentAction(input: CreateAssignmentInput): Promise<ActionResult<Assignment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const worker = await getCoreWorkersService().getWorkerById(input.worker_id);
  if (!worker || worker.workspace_id !== workspaceId) return { success: false, error: "This worker could not be found." };
  if (worker.status === "terminated") return { success: false, error: "A terminated worker cannot be assigned." };
  if (worker.status === "on_leave") return { success: false, error: "A worker on leave cannot be assigned — end their leave first." };

  const result = await getCoreAssignmentsService().createAssignment(workspaceId, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };

  const nodeType = resolveAssignableNodeType(input.assignable_type);
  if (nodeType) {
    await getCoreKnowledgeGraphService().createRelationship(workspaceId, session.membership.id, {
      sourceNodeType: "worker",
      sourceNodeId: worker.id,
      targetNodeType: nodeType,
      targetNodeId: input.assignable_id,
      relationshipType: "assigned_to",
      source: "user_action",
    });
  }

  const assignableLabel = await resolveAssignableLabel(workspaceId, input.assignable_type, input.assignable_id);
  const event = assignmentCreatedEvent(workerFullName(worker), assignableLabel);
  recordTimelineActivity(workspaceId, "worker", worker.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function endAssignmentAction(assignmentId: string, status: Exclude<AssignmentStatus, "active"> = "completed"): Promise<ActionResult<Assignment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const existing = await getCoreAssignmentsService().getAssignmentById(assignmentId);
  if (!existing || existing.workspace_id !== workspaceId) return { success: false, error: "This assignment could not be found." };

  const result = await getCoreAssignmentsService().setAssignmentStatus(assignmentId, workspaceId, status);
  if (!result.success) return { success: false, error: result.error };

  const worker = await getCoreWorkersService().getWorkerById(existing.worker_id);
  const assignableLabel = await resolveAssignableLabel(workspaceId, existing.assignable_type, existing.assignable_id);
  const event = assignmentEndedEvent(worker ? workerFullName(worker) : existing.worker_id, assignableLabel, status);
  recordTimelineActivity(workspaceId, "worker", existing.worker_id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function startMobileSessionAction(input: StartMobileSessionInput): Promise<ActionResult<MobileSession>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const worker = await getCoreWorkersService().getWorkerById(input.worker_id);
  if (!worker || worker.workspace_id !== session.workspace.id) return { success: false, error: "This worker could not be found." };

  const result = await getCoreMobileSessionsService().startSession(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = mobileSessionStartedEvent(workerFullName(worker), input.device_label);
  recordTimelineActivity(session.workspace.id, "worker", worker.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function touchMobileSessionAction(sessionId: string): Promise<ActionResult<MobileSession>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreMobileSessionsService().touchSession(sessionId, session.workspace.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function endMobileSessionAction(sessionId: string): Promise<ActionResult<MobileSession>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreMobileSessionsService().endSession(sessionId, session.workspace.id, "revoked");
  if (!result.success) return { success: false, error: result.error };

  const worker = await getCoreWorkersService().getWorkerById(result.data.worker_id);
  const event = mobileSessionEndedEvent(worker ? workerFullName(worker) : result.data.worker_id, result.data.device_label);
  recordTimelineActivity(session.workspace.id, "worker", result.data.worker_id, event.type, event.description);

  return { success: true, data: result.data };
}

/** Infra only — writes a `"pending"` entry, never syncs it. See `types/workforce.ts`'s `OfflineQueueEntry` doc. */
export async function queueOfflineEntryAction(input: QueueOfflineEntryInput): Promise<ActionResult<OfflineQueueEntry>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreOfflineQueueService().queueEntry(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

/** Infra only — overwrites the worker's single latest snapshot, keeps no history. See `types/workforce.ts`'s `LocationSnapshot` doc. */
export async function recordLocationSnapshotAction(input: RecordLocationInput): Promise<ActionResult<LocationSnapshot>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreLocationService().recordSnapshot(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

/** Read-only public action wrapping the same latest-snapshot-only store `recordLocationSnapshotAction` writes to — added so Operations Center's own Map Placeholder (v2.0 Checkpoint 31) can read location counts/staleness without reaching into `getCoreLocationService()` directly. Never returns a history, only ever the single latest snapshot per worker. */
export async function listLocationSnapshotsAction(): Promise<ActionResult<LocationSnapshot[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const snapshots = await getCoreLocationService().listLatestSnapshotsForWorkspace(session.workspace.id);
  return { success: true, data: snapshots };
}

export async function createEquipmentAction(input: CreateEquipmentInput): Promise<ActionResult<Equipment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreEquipmentService().createEquipment(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = equipmentCreatedEvent(result.data.name);
  recordTimelineActivity(session.workspace.id, "equipment", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function setEquipmentStatusAction(equipmentId: string, status: EquipmentStatus): Promise<ActionResult<Equipment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreEquipmentService().setEquipmentStatus(equipmentId, session.workspace.id, status);
  if (!result.success) return { success: false, error: result.error };

  const event = equipmentStatusChangedEvent(result.data.name, status);
  recordTimelineActivity(session.workspace.id, "equipment", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function assignEquipmentAction(equipmentId: string, workerId: string | null): Promise<ActionResult<Equipment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreEquipmentService().assignEquipment(equipmentId, session.workspace.id, workerId);
  if (!result.success) return { success: false, error: result.error };

  const worker = workerId ? await getCoreWorkersService().getWorkerById(workerId) : null;
  const event = equipmentAssignedEvent(result.data.name, worker ? workerFullName(worker) : null);
  recordTimelineActivity(session.workspace.id, "equipment", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function createVehicleAction(input: CreateVehicleInput): Promise<ActionResult<Vehicle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreVehiclesService().createVehicle(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };

  const event = vehicleCreatedEvent(result.data.label);
  recordTimelineActivity(session.workspace.id, "vehicle", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function setVehicleStatusAction(vehicleId: string, status: VehicleStatus): Promise<ActionResult<Vehicle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreVehiclesService().setVehicleStatus(vehicleId, session.workspace.id, status);
  if (!result.success) return { success: false, error: result.error };

  const event = vehicleStatusChangedEvent(result.data.label, status);
  recordTimelineActivity(session.workspace.id, "vehicle", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export async function assignVehicleAction(vehicleId: string, workerId: string | null): Promise<ActionResult<Vehicle>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workforce.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await getCoreVehiclesService().assignVehicle(vehicleId, session.workspace.id, workerId);
  if (!result.success) return { success: false, error: result.error };

  const worker = workerId ? await getCoreWorkersService().getWorkerById(workerId) : null;
  const event = vehicleAssignedEvent(result.data.label, worker ? workerFullName(worker) : null);
  recordTimelineActivity(session.workspace.id, "vehicle", result.data.id, event.type, event.description);

  return { success: true, data: result.data };
}

export interface EvaluateWorkforceResult {
  workers: Worker[];
  teams: Team[];
  assignments: Assignment[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  expiringCertifications: ExpiringCertification[];
  equipmentUtilization: EquipmentUtilization;
  vehicleUtilization: VehicleUtilization;
  scorecard: WorkforceScorecard;
}

/**
 * v2.0 Checkpoint 26, Step 13 — the single orchestrator the Workforce
 * Dashboard reads from. Fetches every dependency once, feeds the pure
 * engines, returns a coherent snapshot — same shape every other
 * `evaluateXAction()` in this checkpoint series uses.
 */
export async function evaluateWorkforceAction(): Promise<ActionResult<EvaluateWorkforceResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const [workers, teams, assignments, equipment, vehicles, mobileSessions] = await Promise.all([
    getCoreWorkersService().listWorkersForWorkspace(workspaceId, false),
    getCoreTeamsService().listTeamsForWorkspace(workspaceId, false),
    getCoreAssignmentsService().listAssignmentsForWorkspace(workspaceId),
    getCoreEquipmentService().listEquipmentForWorkspace(workspaceId, false),
    getCoreVehiclesService().listVehiclesForWorkspace(workspaceId, false),
    getCoreMobileSessionsService().listSessionsForWorkspace(workspaceId),
  ]);

  const windows = await getCoreAvailabilityService().listWindowsForWorkspace(workspaceId);
  const activeAssignments = assignments.filter((a) => a.status === "active");
  const availabilitySummary = computeAvailabilitySummary(workers, windows, activeAssignments, now);
  const expiringCertifications = findExpiringCertifications(workers, 30, now);
  const activeMobileSessions = mobileSessions.filter((s) => deriveSessionStatus(s, now) === "active");
  const equipmentUtilization = computeEquipmentUtilization(equipment);
  const vehicleUtilization = computeVehicleUtilization(vehicles);

  const scorecard = computeWorkforceScorecard({
    workers,
    teams,
    assignments,
    equipment,
    vehicles,
    activeMobileSessions,
    availabilitySummary,
    expiringCertifications,
    evaluatedAt: now,
  });

  return { success: true, data: { workers, teams, assignments, equipment, vehicles, expiringCertifications, equipmentUtilization, vehicleUtilization, scorecard } };
}

export { resolveCurrentAvailability };
