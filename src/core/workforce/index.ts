import { mockWorkersRepository } from "@/lib/data/mock/workersStore";
import { mockTeamsRepository } from "@/lib/data/mock/teamsStore";
import { mockAvailabilityRepository } from "@/lib/data/mock/availabilityStore";
import { mockAssignmentsRepository } from "@/lib/data/mock/assignmentsStore";
import { mockMobileSessionsRepository } from "@/lib/data/mock/mobileSessionsStore";
import { mockOfflineQueueRepository } from "@/lib/data/mock/offlineQueueStore";
import { mockLocationRepository } from "@/lib/data/mock/locationStore";
import { mockEquipmentRepository } from "@/lib/data/mock/equipmentStore";
import { mockVehiclesRepository } from "@/lib/data/mock/vehiclesStore";

export type { Worker, WorkerRole, WorkerStatus, EmploymentType, CurrentActivityState, WorkerSkill, WorkerCertification } from "@/types/workforce";
export type { Team, TeamStatus } from "@/types/workforce";
export type { AvailabilityWindow, AvailabilityStatus } from "@/types/workforce";
export type { Assignment, AssignableType, AssignmentStatus } from "@/types/workforce";
export type { MobileSession, MobileSessionStatus, MobilePlatform } from "@/types/workforce";
export type { OfflineQueueEntry } from "@/types/workforce";
export type { LocationSnapshot } from "@/types/workforce";
export type { Equipment, EquipmentStatus } from "@/types/workforce";
export type { Vehicle, VehicleStatus } from "@/types/workforce";

export type { CreateWorkerInput, WorkersRepository } from "@/lib/data/mock/workersStore";
export type { CreateTeamInput, TeamsRepository } from "@/lib/data/mock/teamsStore";
export type { CreateAvailabilityWindowInput, AvailabilityRepository } from "@/lib/data/mock/availabilityStore";
export type { CreateAssignmentInput, AssignmentsRepository } from "@/lib/data/mock/assignmentsStore";
export type { StartMobileSessionInput, MobileSessionsRepository } from "@/lib/data/mock/mobileSessionsStore";
export type { QueueOfflineEntryInput, OfflineQueueRepository } from "@/lib/data/mock/offlineQueueStore";
export type { RecordLocationInput, LocationRepository } from "@/lib/data/mock/locationStore";
export type { CreateEquipmentInput, EquipmentRepository } from "@/lib/data/mock/equipmentStore";
export type { CreateVehicleInput, VehiclesRepository } from "@/lib/data/mock/vehiclesStore";

/**
 * v2.0 Checkpoint 26 — Mobile Workforce Platform Foundation. Mock-only
 * accessors — no Supabase table exists yet for any workforce concept, same
 * precedent as `core/objectives`/`core/executiveDecisions`. One accessor
 * per sub-store, all grouped in this single file because they're one
 * cohesive domain (mirrors how `executiveDecisionsActions.ts` composes
 * multiple stores under one module layer).
 */
export function getCoreWorkersService() {
  return mockWorkersRepository;
}

export function getCoreTeamsService() {
  return mockTeamsRepository;
}

export function getCoreAvailabilityService() {
  return mockAvailabilityRepository;
}

export function getCoreAssignmentsService() {
  return mockAssignmentsRepository;
}

export function getCoreMobileSessionsService() {
  return mockMobileSessionsRepository;
}

export function getCoreOfflineQueueService() {
  return mockOfflineQueueRepository;
}

export function getCoreLocationService() {
  return mockLocationRepository;
}

export function getCoreEquipmentService() {
  return mockEquipmentRepository;
}

export function getCoreVehiclesService() {
  return mockVehiclesRepository;
}
