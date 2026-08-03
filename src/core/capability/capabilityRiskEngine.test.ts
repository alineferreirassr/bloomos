import { describe, expect, it } from "vitest";
import { detectWorkforceRisks } from "@/core/capability/capabilityRiskEngine";
import type { CapabilityRequirement, RequirementEvaluationResult, WorkerRankingEntry } from "@/types/capability";
import type { Worker, Equipment, Vehicle, Team } from "@/types/workforce";

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

function makeRankingEntry(workerId: string, rank: number | null, availabilityScore = 100): WorkerRankingEntry {
  return {
    workerId,
    rank,
    eligibility: { requirementId: "req_1", workerId, state: rank !== null ? "eligible" : "ineligible", blockingReasons: [], satisfiedHardRequirements: [], unsatisfiedHardRequirements: [], matchedPreferences: [], unmatchedPreferences: [], expiringSoonCertifications: [], unavailableResources: [], fallbacksUsed: [], evaluatedAt: NOW },
    scores: { requirementId: "req_1", workerId, eligibilityScore: 100, skillsMatchScore: 100, certificationScore: 100, experienceScore: 100, languageScore: 100, availabilityScore, equipmentScore: 100, vehicleScore: 100, locationScore: 100, teamFitScore: 100, capacityScore: 100, preferenceScore: 100, overallCapabilityScore: 100 },
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
    skills: [],
    certifications: [],
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

describe("detectWorkforceRisks", () => {
  it("detects no_eligible_worker when nobody is ranked", () => {
    const requirement = makeRequirement();
    const result: RequirementEvaluationResult = { requirement, ranking: [], eligibleCount: 0, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "no_eligible_worker" && r.severity === "high")).toBe(true);
  });

  it("detects single_eligible_worker when exactly one worker qualifies", () => {
    const requirement = makeRequirement();
    const result: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "single_eligible_worker" && r.relatedWorkerId === "w1")).toBe(true);
  });

  it("detects all_eligible_unavailable only when the requirement actually constrains availability", () => {
    const requirement = makeRequirement({ required_availability_statuses: ["available"] });
    const result: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1, 0), makeRankingEntry("w2", 2, 0)], eligibleCount: 2, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "all_eligible_unavailable")).toBe(true);
  });

  it("does not detect all_eligible_unavailable when the requirement has no availability constraint", () => {
    const requirement = makeRequirement({ required_availability_statuses: [] });
    const result: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1, 0)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "all_eligible_unavailable")).toBe(false);
  });

  it("detects missing_equipment_coverage/missing_vehicle_coverage when zero available instances exist", () => {
    const requirement = makeRequirement({ required_equipment_types: ["drone"], required_vehicle_types: ["van"] });
    const result: RequirementEvaluationResult = { requirement, ranking: [], eligibleCount: 0, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "missing_equipment_coverage")).toBe(true);
    expect(risks.some((r) => r.type === "missing_vehicle_coverage")).toBe(true);
  });

  it("detects expired_certification and certification_expiring_soon independently", () => {
    const workers = [
      makeWorker({ id: "w1", certifications: [{ id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: NOW, expiration_date: "2026-01-01T00:00:00.000Z", verified: true }] }),
      makeWorker({ id: "w2", certifications: [{ id: "c2", name: "OSHA 30", issuer: "OSHA", issued_date: NOW, expiration_date: "2026-08-10T00:00:00.000Z", verified: true }] }),
    ];
    const risks = detectWorkforceRisks({ evaluationResults: [], activeWorkers: workers, equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "expired_certification" && r.relatedWorkerId === "w1")).toBe(true);
    expect(risks.some((r) => r.type === "certification_expiring_soon" && r.relatedWorkerId === "w2")).toBe(true);
  });

  it("detects worker_overreliance at 2 single-worker dependencies, worker_critical_capability_overload at 3", () => {
    const req1 = makeRequirement({ id: "req_1" });
    const req2 = makeRequirement({ id: "req_2" });
    const req3 = makeRequirement({ id: "req_3" });
    const evaluationResults: RequirementEvaluationResult[] = [
      { requirement: req1, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW },
      { requirement: req2, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW },
    ];
    const twoRisks = detectWorkforceRisks({ evaluationResults, activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(twoRisks.some((r) => r.type === "worker_overreliance" && r.relatedWorkerId === "w1")).toBe(true);
    expect(twoRisks.some((r) => r.type === "worker_critical_capability_overload")).toBe(false);

    const threeResults = [...evaluationResults, { requirement: req3, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW }];
    const threeRisks = detectWorkforceRisks({ evaluationResults: threeResults, activeWorkers: [], equipment: [], vehicles: [], activeTeams: [], now: NOW });
    expect(threeRisks.some((r) => r.type === "worker_critical_capability_overload" && r.relatedWorkerId === "w1")).toBe(true);
  });

  it("detects equipment_single_point_of_failure/vehicle_single_point_of_failure only for types actually required", () => {
    const requirement = makeRequirement({ required_equipment_types: ["drone"], required_vehicle_types: ["van"] });
    const result: RequirementEvaluationResult = { requirement, ranking: [], eligibleCount: 0, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const equipment: Equipment[] = [{ id: "eq1", workspace_id: "ws_1", name: "Drone", category: "drone", status: "available", assigned_worker_id: null, serial_number: null, notes: null, created_at: NOW, updated_at: NOW, archived_at: null }];
    const vehicles: Vehicle[] = [{ id: "v1", workspace_id: "ws_1", label: "Van", vehicle_type: "van", make: null, model: null, year: null, license_plate: null, status: "available", assigned_worker_id: null, notes: null, created_at: NOW, updated_at: NOW, archived_at: null }];
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [], equipment, vehicles, activeTeams: [], now: NOW });
    expect(risks.some((r) => r.type === "equipment_single_point_of_failure" && r.relatedEquipmentId === "eq1")).toBe(true);
    expect(risks.some((r) => r.type === "vehicle_single_point_of_failure" && r.relatedVehicleId === "v1")).toBe(true);
  });

  it("detects team_overreliance only when a single team supplies every requirement's qualified workers and 2+ teams exist", () => {
    const team1: Team = { id: "team_1", workspace_id: "ws_1", name: "Crew A", description: null, leader_worker_id: null, member_worker_ids: ["w1"], status: "active", created_at: NOW, updated_at: NOW, archived_at: null };
    const team2: Team = { id: "team_2", workspace_id: "ws_1", name: "Crew B", description: null, leader_worker_id: null, member_worker_ids: ["w2"], status: "active", created_at: NOW, updated_at: NOW, archived_at: null };
    const worker1 = makeWorker({ id: "w1", team_id: "team_1" });
    const requirement = makeRequirement();
    const result: RequirementEvaluationResult = { requirement, ranking: [makeRankingEntry("w1", 1)], eligibleCount: 1, conditionallyEligibleCount: 0, ineligibleCount: 0, evaluatedAt: NOW };
    const risks = detectWorkforceRisks({ evaluationResults: [result], activeWorkers: [worker1], equipment: [], vehicles: [], activeTeams: [team1, team2], now: NOW });
    expect(risks.some((r) => r.type === "team_overreliance")).toBe(true);
  });
});
