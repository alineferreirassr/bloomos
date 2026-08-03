import { describe, expect, it } from "vitest";
import { capabilityRisksToRecommendations } from "@/core/capability/capabilityFindingsEngine";
import type { WorkforceRisk, CapabilityRequirement } from "@/types/capability";

const NOW = "2026-07-30T00:00:00.000Z";

function makeRisk(overrides: Partial<WorkforceRisk> = {}): WorkforceRisk {
  return { id: "risk_1", type: "no_eligible_worker", severity: "high", description: "No eligible worker.", relatedRequirementId: null, relatedWorkerId: null, relatedEquipmentId: null, relatedVehicleId: null, ...overrides };
}

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

describe("capabilityRisksToRecommendations", () => {
  it("maps severity to the existing RecommendationSeverity scale", () => {
    const recs = capabilityRisksToRecommendations([makeRisk({ severity: "high" }), makeRisk({ id: "r2", severity: "medium" }), makeRisk({ id: "r3", severity: "low" })], [], "ws_1");
    expect(recs.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("names the ruleId with the workforce_capability namespace, never a bare message", () => {
    const recs = capabilityRisksToRecommendations([makeRisk({ type: "single_eligible_worker" })], [], "ws_1");
    expect(recs[0].ruleId).toBe("workforce_capability.single_eligible_worker");
  });

  it("prefers a worker node when relatedWorkerId is set", () => {
    const recs = capabilityRisksToRecommendations([makeRisk({ relatedWorkerId: "worker_1" })], [], "ws_1");
    expect(recs[0].node).toEqual({ nodeType: "worker", nodeId: "worker_1" });
  });

  it("prefers equipment, then vehicle, then requirement context, then workspace, in that order", () => {
    expect(capabilityRisksToRecommendations([makeRisk({ relatedEquipmentId: "eq1" })], [], "ws_1")[0].node).toEqual({ nodeType: "equipment", nodeId: "eq1" });
    expect(capabilityRisksToRecommendations([makeRisk({ relatedVehicleId: "v1" })], [], "ws_1")[0].node).toEqual({ nodeType: "vehicle", nodeId: "v1" });

    const requirement = makeRequirement({ context: { nodeType: "event", nodeId: "event_1" } });
    expect(capabilityRisksToRecommendations([makeRisk({ relatedRequirementId: requirement.id })], [requirement], "ws_1")[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });

    expect(capabilityRisksToRecommendations([makeRisk()], [], "ws_1")[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("returns an empty list for an empty risk list — never fabricates a finding", () => {
    expect(capabilityRisksToRecommendations([], [], "ws_1")).toEqual([]);
  });
});
