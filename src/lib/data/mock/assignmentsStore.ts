import type { Assignment, AssignableType } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 26, Step 6 — Assignment registry persistence. Same convention as `workersStore.ts`. */
let assignments: Assignment[] = [];

export function resetAssignmentsStore(): void {
  assignments = [];
}

export interface CreateAssignmentInput {
  worker_id: string;
  assignable_type: AssignableType;
  assignable_id: string;
  role_note: string | null;
  starts_at: string;
}

async function listAssignmentsForWorkspace(workspaceId: string): Promise<Assignment[]> {
  return assignments.filter((a) => a.workspace_id === workspaceId);
}

async function listAssignmentsForWorker(workerId: string): Promise<Assignment[]> {
  return assignments.filter((a) => a.worker_id === workerId);
}

async function getAssignmentById(id: string): Promise<Assignment | null> {
  return assignments.find((a) => a.id === id) ?? null;
}

async function createAssignment(workspaceId: string, createdBy: string, input: CreateAssignmentInput): Promise<DataResult<Assignment>> {
  const timestamp = nowIso();
  const assignment: Assignment = {
    id: generateId("assignment"),
    workspace_id: workspaceId,
    worker_id: input.worker_id,
    assignable_type: input.assignable_type,
    assignable_id: input.assignable_id,
    role_note: input.role_note,
    status: "active",
    starts_at: input.starts_at,
    ends_at: null,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  assignments = [...assignments, assignment];
  return ok(assignment);
}

async function setAssignmentStatus(id: string, workspaceId: string, status: Assignment["status"]): Promise<DataResult<Assignment>> {
  const existing = assignments.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This assignment could not be found.");

  const timestamp = nowIso();
  const updated: Assignment = { ...existing, status, ends_at: status !== "active" ? timestamp : existing.ends_at, updated_at: timestamp };
  assignments = assignments.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

export interface AssignmentsRepository {
  listAssignmentsForWorkspace: typeof listAssignmentsForWorkspace;
  listAssignmentsForWorker: typeof listAssignmentsForWorker;
  getAssignmentById: typeof getAssignmentById;
  createAssignment: typeof createAssignment;
  setAssignmentStatus: typeof setAssignmentStatus;
}

export const mockAssignmentsRepository: AssignmentsRepository = {
  listAssignmentsForWorkspace,
  listAssignmentsForWorker,
  getAssignmentById,
  createAssignment,
  setAssignmentStatus,
};
