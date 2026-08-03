import type { Team, Worker, AvailabilityWindow, Assignment, AvailabilityStatus } from "@/types/workforce";
import { resolveCurrentAvailability } from "@/core/workforce/availabilityEngine";

/** v2.0 Checkpoint 26, Step 3 — Team Engine. Pure functions over already-fetched data. */

export interface TeamValidationResult {
  allowed: boolean;
  reasons: string[];
}

/** A worker can join at most one team at a time in this foundation (no cross-team matrixing yet) — reassignment is an explicit remove-then-add, never an implicit move. */
export function canAddMemberToTeam(worker: Pick<Worker, "id" | "status" | "team_id">, team: Pick<Team, "id" | "status">): TeamValidationResult {
  const reasons: string[] = [];
  if (worker.status === "terminated") reasons.push("A terminated worker cannot join a team.");
  if (team.status !== "active") reasons.push("Only an active team can accept members.");
  if (worker.team_id !== null && worker.team_id !== team.id) reasons.push("This worker already belongs to another team — remove them from it first.");
  return { allowed: reasons.length === 0, reasons };
}

export interface TeamCapacitySummary {
  teamId: string;
  memberCount: number;
  activeMemberCount: number;
  hasLeader: boolean;
}

export function computeTeamCapacitySummary(team: Team, workers: Worker[]): TeamCapacitySummary {
  const members = workers.filter((w) => team.member_worker_ids.includes(w.id));
  return {
    teamId: team.id,
    memberCount: members.length,
    activeMemberCount: members.filter((w) => w.status === "active").length,
    hasLeader: team.leader_worker_id !== null && team.member_worker_ids.includes(team.leader_worker_id),
  };
}

export interface TeamAvailabilityAggregate {
  teamId: string;
  countsByStatus: Record<AvailabilityStatus, number>;
}

export function aggregateTeamAvailability(team: Team, workers: Worker[], windows: AvailabilityWindow[], activeAssignments: Assignment[], now: string): TeamAvailabilityAggregate {
  const members = workers.filter((w) => team.member_worker_ids.includes(w.id));
  const countsByStatus: Record<AvailabilityStatus, number> = {
    available: 0,
    on_assignment: 0,
    busy: 0,
    on_break: 0,
    off_duty: 0,
    vacation: 0,
    sick_leave: 0,
    training: 0,
    unavailable: 0,
  };

  for (const member of members) {
    const status = resolveCurrentAvailability(member, windows, activeAssignments, now);
    countsByStatus[status]++;
  }

  return { teamId: team.id, countsByStatus };
}
