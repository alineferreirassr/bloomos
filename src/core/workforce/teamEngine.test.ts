import { describe, expect, it } from "vitest";
import { canAddMemberToTeam, computeTeamCapacitySummary, aggregateTeamAvailability } from "@/core/workforce/teamEngine";
import type { Worker, Team, AvailabilityWindow } from "@/types/workforce";

const NOW = "2026-07-30T12:00:00.000Z";

function makeWorker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: "worker_1",
    workspace_id: "ws_1",
    first_name: "Ana",
    last_name: "Ferreira",
    email: "ana@example.com",
    phone: null,
    role: "technician",
    employment_type: "full_time",
    status: "active",
    current_activity: "idle",
    team_id: null,
    supervisor_worker_id: null,
    linked_member_id: null,
    time_zone: "America/Sao_Paulo",
    language: "en",
    languages: ["en"],
    experience_level: "entry",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [],
    certifications: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "team_1",
    workspace_id: "ws_1",
    name: "Install Crew",
    description: null,
    leader_worker_id: null,
    member_worker_ids: [],
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("canAddMemberToTeam", () => {
  it("allows an active worker with no team joining an active team", () => {
    const result = canAddMemberToTeam(makeWorker(), makeTeam());
    expect(result.allowed).toBe(true);
  });

  it("blocks a terminated worker", () => {
    const result = canAddMemberToTeam(makeWorker({ status: "terminated" }), makeTeam());
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("blocks joining a non-active team", () => {
    const result = canAddMemberToTeam(makeWorker(), makeTeam({ status: "archived" }));
    expect(result.allowed).toBe(false);
  });

  it("blocks a worker who already belongs to a different team", () => {
    const result = canAddMemberToTeam(makeWorker({ team_id: "team_other" }), makeTeam({ id: "team_1" }));
    expect(result.allowed).toBe(false);
  });

  it("allows re-adding a worker who already belongs to this same team", () => {
    const result = canAddMemberToTeam(makeWorker({ team_id: "team_1" }), makeTeam({ id: "team_1" }));
    expect(result.allowed).toBe(true);
  });
});

describe("computeTeamCapacitySummary", () => {
  it("counts only real members and detects a valid leader", () => {
    const leader = makeWorker({ id: "leader" });
    const member = makeWorker({ id: "member", status: "on_leave" });
    const team = makeTeam({ member_worker_ids: ["leader", "member"], leader_worker_id: "leader" });

    const summary = computeTeamCapacitySummary(team, [leader, member]);
    expect(summary.memberCount).toBe(2);
    expect(summary.activeMemberCount).toBe(1);
    expect(summary.hasLeader).toBe(true);
  });

  it("reports hasLeader: false when the leader isn't in member_worker_ids", () => {
    const team = makeTeam({ member_worker_ids: [], leader_worker_id: "ghost" });
    expect(computeTeamCapacitySummary(team, []).hasLeader).toBe(false);
  });
});

describe("aggregateTeamAvailability", () => {
  it("only aggregates the team's own members", () => {
    const memberA = makeWorker({ id: "a" });
    const memberB = makeWorker({ id: "b" });
    const outsider = makeWorker({ id: "c" });
    const team = makeTeam({ member_worker_ids: ["a", "b"] });
    const windows: AvailabilityWindow[] = [
      { id: "w1", worker_id: "a", workspace_id: "ws_1", status: "available", starts_at: "2026-07-30T00:00:00.000Z", ends_at: null, note: null, time_zone: "UTC", created_at: NOW },
      { id: "w2", worker_id: "b", workspace_id: "ws_1", status: "busy", starts_at: "2026-07-30T00:00:00.000Z", ends_at: null, note: null, time_zone: "UTC", created_at: NOW },
      { id: "w3", worker_id: "c", workspace_id: "ws_1", status: "vacation", starts_at: "2026-07-30T00:00:00.000Z", ends_at: null, note: null, time_zone: "UTC", created_at: NOW },
    ];

    const aggregate = aggregateTeamAvailability(team, [memberA, memberB, outsider], windows, [], NOW);
    expect(aggregate.countsByStatus.available).toBe(1);
    expect(aggregate.countsByStatus.busy).toBe(1);
    expect(aggregate.countsByStatus.vacation).toBe(0);
  });
});
