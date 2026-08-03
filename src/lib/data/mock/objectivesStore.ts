import type { Objective, ObjectiveStatus, ObjectiveDependency, ObjectiveRequirement, ObjectiveScope } from "@/types/objectives";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Objective Registry persistence. Same
 * `let` array + `resetXStore()` convention every mock store in this
 * codebase uses (`knowledgeGraphStore.ts`, `businessHealthSnapshotsStore.ts`).
 * Mock-only — no Supabase table exists yet, same precedent as `core/comments`/
 * `core/tags`.
 */
let objectives: Objective[] = [];

export function resetObjectivesStore(): void {
  objectives = [];
}

export interface CreateObjectiveInput {
  scope: ObjectiveScope;
  node: KnowledgeNodeRef | null;
  title: string;
  description: string | null;
  requirements: ObjectiveRequirement[];
  dependencies: ObjectiveDependency[];
  due_date: string | null;
}

async function listObjectivesForWorkspace(workspaceId: string, includeArchived = false): Promise<Objective[]> {
  return objectives.filter((o) => o.workspace_id === workspaceId && (includeArchived || o.archived_at === null));
}

async function getObjectiveById(id: string): Promise<Objective | null> {
  return objectives.find((o) => o.id === id) ?? null;
}

async function createObjective(workspaceId: string, createdBy: string, input: CreateObjectiveInput): Promise<DataResult<Objective>> {
  if (!input.title.trim()) return fail("Please fix the highlighted fields.", { title: "Title is required." });

  const timestamp = nowIso();
  const objective: Objective = {
    id: generateId("objective"),
    workspace_id: workspaceId,
    scope: input.scope,
    node: input.node,
    title: input.title.trim(),
    description: input.description,
    status: "not_started",
    requirements: input.requirements,
    dependencies: input.dependencies,
    due_date: input.due_date,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  objectives = [...objectives, objective];
  return ok(objective);
}

async function setObjectiveStatus(id: string, workspaceId: string, status: ObjectiveStatus): Promise<DataResult<Objective>> {
  const existing = objectives.find((o) => o.id === id && o.workspace_id === workspaceId);
  if (!existing) return fail("This objective could not be found.");

  const updated: Objective = { ...existing, status, updated_at: nowIso(), archived_at: status === "archived" ? nowIso() : existing.archived_at };
  objectives = objectives.map((o) => (o.id === id ? updated : o));
  return ok(updated);
}

async function updateObjective(
  id: string,
  workspaceId: string,
  input: Partial<Pick<Objective, "title" | "description" | "requirements" | "dependencies" | "due_date">>,
): Promise<DataResult<Objective>> {
  const existing = objectives.find((o) => o.id === id && o.workspace_id === workspaceId);
  if (!existing) return fail("This objective could not be found.");

  const updated: Objective = { ...existing, ...input, updated_at: nowIso() };
  objectives = objectives.map((o) => (o.id === id ? updated : o));
  return ok(updated);
}

export interface ObjectivesRepository {
  listObjectivesForWorkspace: typeof listObjectivesForWorkspace;
  getObjectiveById: typeof getObjectiveById;
  createObjective: typeof createObjective;
  setObjectiveStatus: typeof setObjectiveStatus;
  updateObjective: typeof updateObjective;
}

export const mockObjectivesRepository: ObjectivesRepository = {
  listObjectivesForWorkspace,
  getObjectiveById,
  createObjective,
  setObjectiveStatus,
  updateObjective,
};
