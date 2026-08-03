import { describe, expect, it } from "vitest";
import {
  computeEligibilityScore,
  computeSkillsMatchScore,
  computeCertificationScore,
  computeExperienceScore,
  computeLanguageScore,
  computeAvailabilityScore,
  computeTeamFitScore,
  computeCapacityScore,
  computePreferenceScore,
  computeCapabilityScores,
} from "@/core/capability/capabilityScoreEngine";
import type { CapabilityRequirement, CapabilityEligibility } from "@/types/capability";
import type { Worker } from "@/types/workforce";

const NOW = "2026-07-30T00:00:00.000Z";

function makeRequirement(overrides: Partial<CapabilityRequirement> = {}): CapabilityRequirement {
  return {
    id: "req_1",
    workspace_id: "ws_1",
    title: "Lead Rigger",
    description: null,
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_skills: [],
    preferred_skills: [],
    required_certifications: [],
    preferred_certifications: [],
    required_languages: [],
    preferred_languages: [],
    minimum_experience_level: null,
    required_equipment_types: [],
    preferred_equipment_types: [],
    required_vehicle_types: [],
    preferred_vehicle_types: [],
    required_availability_statuses: [],
    required_employment_types: [],
    required_team_id: null,
    preferred_team_id: null,
    preferred_experience_level: null,
    excluded_worker_ids: [],
    excluded_team_ids: [],
    required_time_zone: null,
    maximum_distance_km: null,
    location_requirement: null,
    capacity_requirement: null,
    physical_requirements: [],
    custom_rules: [],
    required_valid_through_date: null,
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

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
    experience_level: "intermediate",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [],
    certifications: [],
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function makeEligibility(overrides: Partial<CapabilityEligibility> = {}): CapabilityEligibility {
  return {
    requirementId: "req_1",
    workerId: "worker_1",
    state: "eligible",
    blockingReasons: [],
    satisfiedHardRequirements: [],
    unsatisfiedHardRequirements: [],
    matchedPreferences: [],
    unmatchedPreferences: [],
    expiringSoonCertifications: [],
    unavailableResources: [],
    fallbacksUsed: [],
    evaluatedAt: NOW,
    ...overrides,
  };
}

describe("every sub-score", () => {
  it("computeEligibilityScore maps state to a fixed value, higher for better states", () => {
    expect(computeEligibilityScore(makeEligibility({ state: "eligible" }))).toBe(100);
    expect(computeEligibilityScore(makeEligibility({ state: "conditionally_eligible" }))).toBe(75);
    expect(computeEligibilityScore(makeEligibility({ state: "unknown" }))).toBe(50);
    expect(computeEligibilityScore(makeEligibility({ state: "ineligible" }))).toBe(0);
  });

  it("computeSkillsMatchScore is 100 (vacuous) when the requirement has no skill constraints", () => {
    expect(computeSkillsMatchScore(makeRequirement(), makeWorker())).toBe(100);
  });

  it("computeSkillsMatchScore reflects partial required-skill satisfaction", () => {
    const requirement = makeRequirement({ required_skills: ["Rigging", "Lighting"] });
    const worker = makeWorker({ skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }] });
    expect(computeSkillsMatchScore(requirement, worker)).toBe(50);
  });

  it("computeCertificationScore treats expiring_soon as 75% credit, not 0 or 100", () => {
    const requirement = makeRequirement({ required_certifications: ["OSHA 30"] });
    const worker = makeWorker({ certifications: [{ id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: "2024-01-01T00:00:00.000Z", expiration_date: "2026-08-10T00:00:00.000Z", verified: true }] });
    expect(computeCertificationScore(requirement, worker, NOW)).toBe(75);
  });

  it("computeExperienceScore is 0 when below a hard minimum, 100 when no experience constraint exists", () => {
    expect(computeExperienceScore(makeRequirement({ minimum_experience_level: "senior" }), makeWorker({ experience_level: "entry" }))).toBe(0);
    expect(computeExperienceScore(makeRequirement(), makeWorker())).toBe(100);
  });

  it("computeExperienceScore never drops below the documented floor of 40 for a preferred shortfall", () => {
    const requirement = makeRequirement({ preferred_experience_level: "expert" });
    expect(computeExperienceScore(requirement, makeWorker({ experience_level: "entry" }))).toBe(40);
  });

  it("computeLanguageScore is vacuous 100 with no language constraint", () => {
    expect(computeLanguageScore(makeRequirement(), makeWorker())).toBe(100);
  });

  it("computeAvailabilityScore is binary when constrained", () => {
    const requirement = makeRequirement({ required_availability_statuses: ["available"] });
    expect(computeAvailabilityScore(requirement, "available")).toBe(100);
    expect(computeAvailabilityScore(requirement, "busy")).toBe(0);
  });

  it("computeTeamFitScore is 0 for a hard team mismatch, partial credit (60) for a missed preference", () => {
    expect(computeTeamFitScore(makeRequirement({ required_team_id: "team_1" }), makeWorker({ team_id: "team_2" }))).toBe(0);
    expect(computeTeamFitScore(makeRequirement({ preferred_team_id: "team_1" }), makeWorker({ team_id: "team_2" }))).toBe(60);
  });

  it("computeCapacityScore decreases with more active assignments, floored at 0", () => {
    expect(computeCapacityScore(0)).toBe(100);
    expect(computeCapacityScore(2)).toBe(60);
    expect(computeCapacityScore(10)).toBe(0);
  });

  it("computePreferenceScore is vacuous 100 when no preferences exist at all", () => {
    expect(computePreferenceScore(makeEligibility())).toBe(100);
  });

  it("computePreferenceScore reflects the matched fraction", () => {
    const eligibility = makeEligibility({ matchedPreferences: [{ rule: "a", detail: "a", matched: true }], unmatchedPreferences: [{ rule: "b", detail: "b", matched: false }] });
    expect(computePreferenceScore(eligibility)).toBe(50);
  });
});

describe("computeCapabilityScores — the composite", () => {
  it("every score stays within [0, 100] and overall is deterministic for identical inputs", () => {
    const requirement = makeRequirement({ required_skills: ["Rigging"] });
    const worker = makeWorker({ skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }] });
    const eligibility = makeEligibility();

    const input = { requirement, worker, eligibility, currentAvailability: "available" as const, workerEquipment: [], teamEquipment: [], workerVehicle: null, teamVehicles: [], workerLocation: null, workerActiveAssignmentCount: 0, now: NOW };
    const a = computeCapabilityScores(input);
    const b = computeCapabilityScores(input);
    expect(a).toEqual(b);

    for (const [key, value] of Object.entries(a)) {
      if (typeof value === "number") {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      void key;
    }
  });

  it("scores a fully-unconstrained requirement as a perfect overall match", () => {
    const requirement = makeRequirement();
    const worker = makeWorker();
    const eligibility = makeEligibility();
    const scores = computeCapabilityScores({ requirement, worker, eligibility, currentAvailability: "available", workerEquipment: [], teamEquipment: [], workerVehicle: null, teamVehicles: [], workerLocation: null, workerActiveAssignmentCount: 0, now: NOW });
    expect(scores.overallCapabilityScore).toBe(100);
  });
});
