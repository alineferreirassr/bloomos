import type { Vehicle, VehicleStatus } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 26, Step 11 — Vehicle Registry persistence. Same convention as `equipmentStore.ts`. */
let vehicles: Vehicle[] = [];

export function resetVehiclesStore(): void {
  vehicles = [];
}

export interface CreateVehicleInput {
  label: string;
  /** v2.0 Checkpoint 26.1 — mirrors `Equipment.category`'s "required, freeform category" convention. */
  vehicle_type: string;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  notes: string | null;
}

async function listVehiclesForWorkspace(workspaceId: string, includeArchived = false): Promise<Vehicle[]> {
  return vehicles.filter((v) => v.workspace_id === workspaceId && (includeArchived || v.archived_at === null));
}

async function getVehicleById(id: string): Promise<Vehicle | null> {
  return vehicles.find((v) => v.id === id) ?? null;
}

async function createVehicle(workspaceId: string, input: CreateVehicleInput): Promise<DataResult<Vehicle>> {
  if (!input.label.trim()) return fail("Please fix the highlighted fields.", { label: "Vehicle label is required." });

  const timestamp = nowIso();
  const vehicle: Vehicle = {
    id: generateId("vehicle"),
    workspace_id: workspaceId,
    label: input.label.trim(),
    vehicle_type: input.vehicle_type,
    make: input.make,
    model: input.model,
    year: input.year,
    license_plate: input.license_plate,
    status: "available",
    assigned_worker_id: null,
    notes: input.notes,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  vehicles = [...vehicles, vehicle];
  return ok(vehicle);
}

async function setVehicleStatus(id: string, workspaceId: string, status: VehicleStatus): Promise<DataResult<Vehicle>> {
  const existing = vehicles.find((v) => v.id === id && v.workspace_id === workspaceId);
  if (!existing) return fail("This vehicle could not be found.");

  const updated: Vehicle = { ...existing, status, updated_at: nowIso() };
  vehicles = vehicles.map((v) => (v.id === id ? updated : v));
  return ok(updated);
}

async function assignVehicle(id: string, workspaceId: string, workerId: string | null): Promise<DataResult<Vehicle>> {
  const existing = vehicles.find((v) => v.id === id && v.workspace_id === workspaceId);
  if (!existing) return fail("This vehicle could not be found.");

  const updated: Vehicle = { ...existing, assigned_worker_id: workerId, status: workerId ? "in_use" : "available", updated_at: nowIso() };
  vehicles = vehicles.map((v) => (v.id === id ? updated : v));
  return ok(updated);
}

export interface VehiclesRepository {
  listVehiclesForWorkspace: typeof listVehiclesForWorkspace;
  getVehicleById: typeof getVehicleById;
  createVehicle: typeof createVehicle;
  setVehicleStatus: typeof setVehicleStatus;
  assignVehicle: typeof assignVehicle;
}

export const mockVehiclesRepository: VehiclesRepository = {
  listVehiclesForWorkspace,
  getVehicleById,
  createVehicle,
  setVehicleStatus,
  assignVehicle,
};
