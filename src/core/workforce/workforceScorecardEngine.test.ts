import { describe, expect, it } from "vitest";
import { computeWorkforceScorecard } from "@/core/workforce/workforceScorecardEngine";
import type { Worker, Team, Assignment, Equipment, Vehicle, MobileSession, AvailabilitySummary, ExpiringCertification } from "@/types/workforce";

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

const availabilitySummary: AvailabilitySummary = { available: 2, onAssignment: 1, busy: 0, onBreak: 0, offDuty: 0, vacation: 0, sickLeave: 0, training: 0, unavailable: 0 };

describe("computeWorkforceScorecard", () => {
  it("is a pure arithmetic rollup over already-computed inputs", () => {
    const workers = [makeWorker({ id: "1", status: "active" }), makeWorker({ id: "2", status: "terminated", archived_at: NOW })];
    const teams: Team[] = [{ id: "t1", workspace_id: "ws_1", name: "Crew", description: null, leader_worker_id: null, member_worker_ids: [], status: "active", created_at: NOW, updated_at: NOW, archived_at: null }];
    const assignments: Assignment[] = [{ id: "a1", workspace_id: "ws_1", worker_id: "1", assignable_type: "event", assignable_id: "e1", role_note: null, status: "active", starts_at: NOW, ends_at: null, created_by: "m1", created_at: NOW, updated_at: NOW }];
    const equipment: Equipment[] = [{ id: "eq1", workspace_id: "ws_1", name: "Drone", category: "media", status: "in_use", assigned_worker_id: "1", serial_number: null, notes: null, created_at: NOW, updated_at: NOW, archived_at: null }];
    const vehicles: Vehicle[] = [{ id: "v1", workspace_id: "ws_1", label: "Van", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, status: "in_use", assigned_worker_id: "1", notes: null, created_at: NOW, updated_at: NOW, archived_at: null }];
    const activeMobileSessions: MobileSession[] = [{ id: "s1", workspace_id: "ws_1", worker_id: "1", device_label: "iPhone", platform: "ios", status: "active", started_at: NOW, last_seen_at: NOW, ended_at: null }];
    const expiringCertifications: ExpiringCertification[] = [];

    const scorecard = computeWorkforceScorecard({ workers, teams, assignments, equipment, vehicles, activeMobileSessions, availabilitySummary, expiringCertifications, evaluatedAt: NOW });

    expect(scorecard).toEqual({
      totalWorkers: 2,
      activeWorkers: 1,
      availableNow: 2,
      onAssignmentNow: 1,
      teamsCount: 1,
      activeAssignments: 1,
      expiringCertificationsCount: 0,
      equipmentInUse: 1,
      vehiclesInUse: 1,
      activeMobileSessions: 1,
      evaluatedAt: NOW,
    });
  });

  it("returns all zeros for an empty workspace", () => {
    const scorecard = computeWorkforceScorecard({
      workers: [],
      teams: [],
      assignments: [],
      equipment: [],
      vehicles: [],
      activeMobileSessions: [],
      availabilitySummary: { available: 0, onAssignment: 0, busy: 0, onBreak: 0, offDuty: 0, vacation: 0, sickLeave: 0, training: 0, unavailable: 0 },
      expiringCertifications: [],
      evaluatedAt: NOW,
    });
    expect(scorecard.totalWorkers).toBe(0);
    expect(scorecard.activeWorkers).toBe(0);
  });
});
