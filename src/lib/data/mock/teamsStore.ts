import type { Team, TeamStatus } from "@/types/workforce";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 26 — Workforce Team registry persistence. Same convention as `workersStore.ts`. */
let teams: Team[] = [];

export function resetTeamsStore(): void {
  teams = [];
}

export interface CreateTeamInput {
  name: string;
  description: string | null;
  leader_worker_id: string | null;
}

async function listTeamsForWorkspace(workspaceId: string, includeArchived = false): Promise<Team[]> {
  return teams.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.archived_at === null));
}

async function getTeamById(id: string): Promise<Team | null> {
  return teams.find((t) => t.id === id) ?? null;
}

async function createTeam(workspaceId: string, input: CreateTeamInput): Promise<DataResult<Team>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Team name is required." });

  const timestamp = nowIso();
  const team: Team = {
    id: generateId("team"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    description: input.description,
    leader_worker_id: input.leader_worker_id,
    member_worker_ids: input.leader_worker_id ? [input.leader_worker_id] : [],
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  teams = [...teams, team];
  return ok(team);
}

async function updateTeam(id: string, workspaceId: string, input: Partial<Pick<Team, "name" | "description" | "leader_worker_id">>): Promise<DataResult<Team>> {
  const existing = teams.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This team could not be found.");

  const updated: Team = { ...existing, ...input, updated_at: nowIso() };
  teams = teams.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

async function addMemberToTeam(id: string, workspaceId: string, workerId: string): Promise<DataResult<Team>> {
  const existing = teams.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This team could not be found.");
  if (existing.member_worker_ids.includes(workerId)) return ok(existing);

  const updated: Team = { ...existing, member_worker_ids: [...existing.member_worker_ids, workerId], updated_at: nowIso() };
  teams = teams.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

async function removeMemberFromTeam(id: string, workspaceId: string, workerId: string): Promise<DataResult<Team>> {
  const existing = teams.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This team could not be found.");

  const updated: Team = {
    ...existing,
    member_worker_ids: existing.member_worker_ids.filter((id_) => id_ !== workerId),
    leader_worker_id: existing.leader_worker_id === workerId ? null : existing.leader_worker_id,
    updated_at: nowIso(),
  };
  teams = teams.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

async function setTeamStatus(id: string, workspaceId: string, status: TeamStatus): Promise<DataResult<Team>> {
  const existing = teams.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This team could not be found.");

  const timestamp = nowIso();
  const updated: Team = { ...existing, status, archived_at: status === "archived" ? timestamp : existing.archived_at, updated_at: timestamp };
  teams = teams.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

export interface TeamsRepository {
  listTeamsForWorkspace: typeof listTeamsForWorkspace;
  getTeamById: typeof getTeamById;
  createTeam: typeof createTeam;
  updateTeam: typeof updateTeam;
  addMemberToTeam: typeof addMemberToTeam;
  removeMemberFromTeam: typeof removeMemberFromTeam;
  setTeamStatus: typeof setTeamStatus;
}

export const mockTeamsRepository: TeamsRepository = {
  listTeamsForWorkspace,
  getTeamById,
  createTeam,
  updateTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  setTeamStatus,
};
