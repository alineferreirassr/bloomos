import { describe, expect, it } from "vitest";
import { summarizeWorkerSkills, findExpiringCertifications, computeTeamSkillCoverage } from "@/core/workforce/skillsEngine";
import type { Worker, Team } from "@/types/workforce";

const NOW = "2026-07-30T00:00:00.000Z";

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

describe("summarizeWorkerSkills", () => {
  it("buckets skills by level and counts expired certifications", () => {
    const worker = makeWorker({
      skills: [
        { id: "s1", name: "Rigging", category: "install", level: "primary" },
        { id: "s2", name: "Lighting", category: "install", level: "secondary" },
        { id: "s3", name: "Drone Piloting", category: "media", level: "learning" },
      ],
      certifications: [
        { id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: "2024-01-01T00:00:00.000Z", expiration_date: "2026-01-01T00:00:00.000Z", verified: true },
        { id: "c2", name: "First Aid", issuer: "Red Cross", issued_date: "2026-06-01T00:00:00.000Z", expiration_date: null, verified: true },
      ],
    });

    const summary = summarizeWorkerSkills(worker, NOW);
    expect(summary.primarySkillNames).toEqual(["Rigging"]);
    expect(summary.secondarySkillNames).toEqual(["Lighting"]);
    expect(summary.learningSkillNames).toEqual(["Drone Piloting"]);
    expect(summary.expiredCertificationCount).toBe(1);
  });
});

describe("findExpiringCertifications", () => {
  it("never returns a never-expiring certification", () => {
    const worker = makeWorker({ certifications: [{ id: "c1", name: "First Aid", issuer: "Red Cross", issued_date: "2026-01-01T00:00:00.000Z", expiration_date: null, verified: true }] });
    expect(findExpiringCertifications([worker], 30, NOW)).toEqual([]);
  });

  it("includes already-expired certifications with a negative daysUntilExpiration", () => {
    const worker = makeWorker({ certifications: [{ id: "c1", name: "Forklift License", issuer: "State", issued_date: "2020-01-01T00:00:00.000Z", expiration_date: "2026-07-01T00:00:00.000Z", verified: true }] });
    const results = findExpiringCertifications([worker], 30, NOW);
    expect(results).toHaveLength(1);
    expect(results[0].daysUntilExpiration).toBeLessThan(0);
  });

  it("excludes certifications expiring beyond the window and sorts soonest-first", () => {
    const soon = makeWorker({ id: "w1", certifications: [{ id: "c1", name: "Soon", issuer: "X", issued_date: "2025-01-01T00:00:00.000Z", expiration_date: "2026-08-05T00:00:00.000Z", verified: true }] });
    const later = makeWorker({ id: "w2", certifications: [{ id: "c2", name: "Later", issuer: "X", issued_date: "2025-01-01T00:00:00.000Z", expiration_date: "2027-01-01T00:00:00.000Z", verified: true }] });

    const results = findExpiringCertifications([later, soon], 30, NOW);
    expect(results).toHaveLength(1);
    expect(results[0].certification.name).toBe("Soon");
  });
});

describe("computeTeamSkillCoverage", () => {
  it("unions skill names across members and counts primary coverage", () => {
    const memberA = makeWorker({ id: "a", skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }] });
    const memberB = makeWorker({ id: "b", skills: [{ id: "s2", name: "Rigging", category: "install", level: "primary" }, { id: "s3", name: "Lighting", category: "install", level: "secondary" }] });
    const nonMember = makeWorker({ id: "c", skills: [{ id: "s4", name: "Photography", category: "media", level: "primary" }] });
    const team = makeTeam({ member_worker_ids: ["a", "b"] });

    const coverage = computeTeamSkillCoverage(team, [memberA, memberB, nonMember]);
    expect(coverage.coveredSkillNames).toEqual(["Lighting", "Rigging"]);
    expect(coverage.primarySkillCoverageCount.Rigging).toBe(2);
    expect(coverage.primarySkillCoverageCount.Photography).toBeUndefined();
  });
});
