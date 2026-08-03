import type { Worker, WorkerRole, EmploymentType, WorkerStatus, CurrentActivityState, EmergencyContact, WorkerSkill, WorkerCertification, ExperienceLevel } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26 — Worker registry persistence. Same `let` array +
 * `resetXStore()` convention every mock store in this codebase uses
 * (`objectivesStore.ts`, `decisionsStore.ts`). Mock-only — no Supabase
 * table exists yet, same precedent as `core/objectives`/`core/executiveDecisions`.
 */
let workers: Worker[] = [];

export function resetWorkersStore(): void {
  workers = [];
}

export interface CreateWorkerInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: WorkerRole;
  employment_type: EmploymentType;
  team_id: string | null;
  supervisor_worker_id: string | null;
  linked_member_id: string | null;
  time_zone: string;
  language: string;
  /** v2.0 Checkpoint 26.1 — optional; defaults to `[language]` when omitted, so every Checkpoint 26 call site stays valid. */
  languages?: string[];
  /** v2.0 Checkpoint 26.1 — optional; defaults to `"entry"` when omitted. */
  experience_level?: ExperienceLevel;
  profile_photo_url: string | null;
  emergency_contact: EmergencyContact | null;
  skills: WorkerSkill[];
  certifications: WorkerCertification[];
}

async function listWorkersForWorkspace(workspaceId: string, includeArchived = false): Promise<Worker[]> {
  return workers.filter((w) => w.workspace_id === workspaceId && (includeArchived || w.archived_at === null));
}

async function getWorkerById(id: string): Promise<Worker | null> {
  return workers.find((w) => w.id === id) ?? null;
}

async function createWorker(workspaceId: string, input: CreateWorkerInput): Promise<DataResult<Worker>> {
  if (!input.first_name.trim() || !input.last_name.trim()) return fail("Please fix the highlighted fields.", { first_name: "First and last name are required." });
  if (!input.email.trim()) return fail("Please fix the highlighted fields.", { email: "Email is required." });

  const timestamp = nowIso();
  const worker: Worker = {
    id: generateId("worker"),
    workspace_id: workspaceId,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    phone: input.phone,
    role: input.role,
    employment_type: input.employment_type,
    status: "active",
    current_activity: "off_duty",
    team_id: input.team_id,
    supervisor_worker_id: input.supervisor_worker_id,
    linked_member_id: input.linked_member_id,
    time_zone: input.time_zone,
    language: input.language,
    languages: input.languages ?? [input.language],
    experience_level: input.experience_level ?? "entry",
    profile_photo_url: input.profile_photo_url,
    emergency_contact: input.emergency_contact,
    skills: input.skills,
    certifications: input.certifications,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  workers = [...workers, worker];
  return ok(worker);
}

async function updateWorker(
  id: string,
  workspaceId: string,
  input: Partial<Pick<Worker, "first_name" | "last_name" | "email" | "phone" | "role" | "employment_type" | "team_id" | "supervisor_worker_id" | "time_zone" | "language" | "profile_photo_url" | "emergency_contact" | "skills" | "certifications">>,
): Promise<DataResult<Worker>> {
  const existing = workers.find((w) => w.id === id && w.workspace_id === workspaceId);
  if (!existing) return fail("This worker could not be found.");

  const updated: Worker = { ...existing, ...input, updated_at: nowIso() };
  workers = workers.map((w) => (w.id === id ? updated : w));
  return ok(updated);
}

async function setWorkerStatus(id: string, workspaceId: string, status: WorkerStatus): Promise<DataResult<Worker>> {
  const existing = workers.find((w) => w.id === id && w.workspace_id === workspaceId);
  if (!existing) return fail("This worker could not be found.");

  const updated: Worker = { ...existing, status, updated_at: nowIso() };
  workers = workers.map((w) => (w.id === id ? updated : w));
  return ok(updated);
}

async function setWorkerCurrentActivity(id: string, workspaceId: string, currentActivity: CurrentActivityState): Promise<DataResult<Worker>> {
  const existing = workers.find((w) => w.id === id && w.workspace_id === workspaceId);
  if (!existing) return fail("This worker could not be found.");

  const updated: Worker = { ...existing, current_activity: currentActivity, updated_at: nowIso() };
  workers = workers.map((w) => (w.id === id ? updated : w));
  return ok(updated);
}

async function archiveWorker(id: string, workspaceId: string): Promise<DataResult<Worker>> {
  const existing = workers.find((w) => w.id === id && w.workspace_id === workspaceId);
  if (!existing) return fail("This worker could not be found.");

  const timestamp = nowIso();
  const updated: Worker = { ...existing, status: "terminated", archived_at: timestamp, updated_at: timestamp };
  workers = workers.map((w) => (w.id === id ? updated : w));
  return ok(updated);
}

async function restoreWorker(id: string, workspaceId: string): Promise<DataResult<Worker>> {
  const existing = workers.find((w) => w.id === id && w.workspace_id === workspaceId);
  if (!existing) return fail("This worker could not be found.");

  const updated: Worker = { ...existing, status: "active", archived_at: null, updated_at: nowIso() };
  workers = workers.map((w) => (w.id === id ? updated : w));
  return ok(updated);
}

export interface WorkersRepository {
  listWorkersForWorkspace: typeof listWorkersForWorkspace;
  getWorkerById: typeof getWorkerById;
  createWorker: typeof createWorker;
  updateWorker: typeof updateWorker;
  setWorkerStatus: typeof setWorkerStatus;
  setWorkerCurrentActivity: typeof setWorkerCurrentActivity;
  archiveWorker: typeof archiveWorker;
  restoreWorker: typeof restoreWorker;
}

export const mockWorkersRepository: WorkersRepository = {
  listWorkersForWorkspace,
  getWorkerById,
  createWorker,
  updateWorker,
  setWorkerStatus,
  setWorkerCurrentActivity,
  archiveWorker,
  restoreWorker,
};
