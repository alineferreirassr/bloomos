import { describe, expect, it } from "vitest";
import { computeCapabilityCoverage } from "@/core/capability/capabilityCoverageEngine";
import type { CapabilityRequirement, RequirementEvaluationResult, WorkerRankingEntry } from "@/types/capability";
import type { Worker, Equipment } from "@/types/workforce";

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
    required_equipment_types: ["drone"],
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
    time_zone: "UTC",
    language: "en",
    languages: ["en"],
    experience_level: "intermediate",
    profile_photo_url: null,
    emergency_contact: null,
    skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }],
    certifications: [],
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

function makeRankingEntry(workerId: string, rank: number | null): WorkerRankingEntry {
  return {
    workerId,
    rank,
    eligibility: { requirementId: "req_1", workerId, state: rank !== null ? "eligible" : "ineligible", blockingReasons: [], satisfiedHardRequirements: [], unsatisfiedHardRequirements: [], matchedPreferences: [], unmatchedPreferences: [], expiringSoonCertifications: [], unavailableResources: [], fallbacksUsed: [], evaluatedAt: NOW },
    scores: { requirementId: "req_1", workerId, eligibilityScore: 100, skillsMatchScore: 100, certificationScore: 100, experienceScore: 100, languageScore: 100, availabilityScore: 100, equipmentScore: 100, vehicleScore: 100, locationScore: 100, teamFitScore: 100, capacityScore: 100, preferenceScore: 100, overallCapabilityScore: 100 },
  };
}

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return { id: "eq1", workspace_id: "ws_1", name: "Drone", category: "drone", status: "available", assigned_worker_id: null, serial_number: null, notes: null, created_at: NOW, updated_at: NOW, archived_at: null, ...overrides };
}

describe("computeCapabilityCoverage", () => {
  it("tallies skills and language coverage across active workers", () => {
    const workers = [makeWorker({ id: "w1" }), makeWorker({ id: "w2", languages: ["en", "pt"] })];
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: workers, availableWorkerCount: 2, activeTeams: [], equipment: [], vehicles: [], evaluationResults: [], now: NOW });
    expect(coverage.skillsCoverage.Rigging).toBe(2);
    expect(coverage.languageCoverage.en).toBe(2);
    expect(coverage.languageCoverage.pt).toBe(1);
  });

  it("excludes unverified/expired certifications from certificationCoverage", () => {
    const workers = [
      makeWorker({ id: "w1", certifications: [{ id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: NOW, expiration_date: null, verified: true }] }),
      makeWorker({ id: "w2", certifications: [{ id: "c2", name: "OSHA 30", issuer: "OSHA", issued_date: NOW, expiration_date: "2026-01-01T00:00:00.000Z", verified: true }] }),
      makeWorker({ id: "w3", certifications: [{ id: "c3", name: "OSHA 30", issuer: "OSHA", issued_date: NOW, expiration_date: null, verified: false }] }),
    ];
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: workers, availableWorkerCount: 3, activeTeams: [], equipment: [], vehicles: [], evaluationResults: [], now: NOW });
    expect(coverage.certificationCoverage["OSHA 30"]).toBe(1);
  });

  it("marks a requirement uncovered when eligible+conditionally_eligible falls short of capacity_requirement", () => {
    const requirement = makeRequirement({ capacity_requirement: 2 });
    const evaluationResult: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: [], availableWorkerCount: 0, activeTeams: [], equipment: [], vehicles: [], evaluationResults: [evaluationResult], now: NOW });
    expect(coverage.uncoveredRequirementIds).toContain(requirement.id);
    expect(coverage.requirementCoverage[0].meetsCapacity).toBe(false);
  });

  it("flags a single-worker dependency when exactly one worker is ranked", () => {
    const requirement = makeRequirement();
    const evaluationResult: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: [], availableWorkerCount: 0, activeTeams: [], equipment: [], vehicles: [], evaluationResults: [evaluationResult], now: NOW });
    expect(coverage.singleWorkerDependencies).toEqual([{ requirementId: requirement.id, workerId: "w1" }]);
  });

  it("flags a single-equipment dependency only for a type an actual requirement needs", () => {
    const requirement = makeRequirement({ required_equipment_types: ["drone"] });
    const evaluationResult: RequirementEvaluationResult = { requirement, ranking: [], eligibleCount: 0, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: [], availableWorkerCount: 0, activeTeams: [], equipment: [makeEquipment()], vehicles: [], evaluationResults: [evaluationResult], now: NOW });
    expect(coverage.singleEquipmentDependencies).toEqual(["drone"]);
  });

  it("does not flag single-equipment dependency for a category no requirement needs", () => {
    const requirement = makeRequirement({ required_equipment_types: [] });
    const evaluationResult: RequirementEvaluationResult = { requirement, ranking: [], eligibleCount: 0, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const coverage = computeCapabilityCoverage({ workspaceId: "ws_1", activeWorkers: [], availableWorkerCount: 0, activeTeams: [], equipment: [makeEquipment()], vehicles: [], evaluationResults: [evaluationResult], now: NOW });
    expect(coverage.singleEquipmentDependencies).toEqual([]);
  });
});
