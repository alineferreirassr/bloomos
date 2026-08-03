import type { Equipment, EquipmentStatus } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 26, Step 10 — Equipment Registry persistence. Same convention as `workersStore.ts`. */
let equipmentItems: Equipment[] = [];

export function resetEquipmentStore(): void {
  equipmentItems = [];
}

export interface CreateEquipmentInput {
  name: string;
  category: string;
  serial_number: string | null;
  notes: string | null;
}

async function listEquipmentForWorkspace(workspaceId: string, includeArchived = false): Promise<Equipment[]> {
  return equipmentItems.filter((e) => e.workspace_id === workspaceId && (includeArchived || e.archived_at === null));
}

async function getEquipmentById(id: string): Promise<Equipment | null> {
  return equipmentItems.find((e) => e.id === id) ?? null;
}

async function createEquipment(workspaceId: string, input: CreateEquipmentInput): Promise<DataResult<Equipment>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Equipment name is required." });

  const timestamp = nowIso();
  const equipment: Equipment = {
    id: generateId("equipment"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    category: input.category,
    status: "available",
    assigned_worker_id: null,
    serial_number: input.serial_number,
    notes: input.notes,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  equipmentItems = [...equipmentItems, equipment];
  return ok(equipment);
}

async function setEquipmentStatus(id: string, workspaceId: string, status: EquipmentStatus): Promise<DataResult<Equipment>> {
  const existing = equipmentItems.find((e) => e.id === id && e.workspace_id === workspaceId);
  if (!existing) return fail("This equipment item could not be found.");

  const updated: Equipment = { ...existing, status, updated_at: nowIso() };
  equipmentItems = equipmentItems.map((e) => (e.id === id ? updated : e));
  return ok(updated);
}

async function assignEquipment(id: string, workspaceId: string, workerId: string | null): Promise<DataResult<Equipment>> {
  const existing = equipmentItems.find((e) => e.id === id && e.workspace_id === workspaceId);
  if (!existing) return fail("This equipment item could not be found.");

  const updated: Equipment = { ...existing, assigned_worker_id: workerId, status: workerId ? "in_use" : "available", updated_at: nowIso() };
  equipmentItems = equipmentItems.map((e) => (e.id === id ? updated : e));
  return ok(updated);
}

export interface EquipmentRepository {
  listEquipmentForWorkspace: typeof listEquipmentForWorkspace;
  getEquipmentById: typeof getEquipmentById;
  createEquipment: typeof createEquipment;
  setEquipmentStatus: typeof setEquipmentStatus;
  assignEquipment: typeof assignEquipment;
}

export const mockEquipmentRepository: EquipmentRepository = {
  listEquipmentForWorkspace,
  getEquipmentById,
  createEquipment,
  setEquipmentStatus,
  assignEquipment,
};
