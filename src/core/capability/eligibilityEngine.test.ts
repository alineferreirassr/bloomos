import { describe, expect, it } from "vitest";
import { evaluateEligibility, type EligibilityContext } from "@/core/capability/eligibilityEngine";
import type { CapabilityRequirement } from "@/types/capability";
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

function makeContext(overrides: Partial<Omit<EligibilityContext, "worker">> = {}): Omit<EligibilityContext, "worker"> {
  return {
    currentAvailability: "available",
    allActiveAssignments: [],
    workerEquipment: [],
    teamEquipment: [],
    workerVehicle: null,
    teamVehicles: [],
    workerLocation: null,
    now: NOW,
    expiringSoonThresholdDays: 30,
    ...overrides,
  };
}

describe("evaluateEligibility — hard requirements", () => {
  it("is eligible when a requirement has no constraints at all", () => {
    const result = evaluateEligibility(makeRequirement(), { worker: makeWorker(), ...makeContext() });
    expect(result.state).toBe("eligible");
    expect(result.blockingReasons).toEqual([]);
  });

  it("blocks on a non-active worker status", () => {
    const worker = makeWorker({ status: "terminated" });
    const context: EligibilityContext = { worker, ...makeContext() };
    const result = evaluateEligibility(makeRequirement(), context);
    expect(result.state).toBe("ineligible");
    expect(result.blockingReasons.some((r) => r.rule === "worker_status")).toBe(true);
  });

  it("blocks on an employment type not in the required list", () => {
    const worker = makeWorker({ employment_type: "contractor" });
    const requirement = makeRequirement({ required_employment_types: ["full_time"] });
    const result = evaluateEligibility(requirement, { worker, ...makeContext() });
    expect(result.state).toBe("ineligible");
  });

  it("blocks on availability not matching a required status", () => {
    const worker = makeWorker();
    const requirement = makeRequirement({ required_availability_statuses: ["available"] });
    const result = evaluateEligibility(requirement, { worker, ...makeContext({ currentAvailability: "busy" }) });
    expect(result.state).toBe("ineligible");
  });

  it("blocks on a missing required skill and passes when present", () => {
    const requirement = makeRequirement({ required_skills: ["Rigging"] });
    const withoutSkill = evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext() });
    expect(withoutSkill.state).toBe("ineligible");
    expect(withoutSkill.blockingReasons[0].rule).toBe("required_skill:Rigging");

    const withSkill = evaluateEligibility(requirement, { worker: makeWorker({ skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }] }), ...makeContext() });
    expect(withSkill.state).toBe("eligible");
  });

  it("blocks on an expired required certification", () => {
    const requirement = makeRequirement({ required_certifications: ["OSHA 30"] });
    const worker = makeWorker({ certifications: [{ id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: "2024-01-01T00:00:00.000Z", expiration_date: "2026-01-01T00:00:00.000Z", verified: true }] });
    const result = evaluateEligibility(requirement, { worker, ...makeContext() });
    expect(result.state).toBe("ineligible");
    expect(result.blockingReasons.some((r) => r.rule === "required_certification:OSHA 30")).toBe(true);
  });

  it("is conditionally_eligible (not ineligible) when a required certification is only expiring soon", () => {
    const requirement = makeRequirement({ required_certifications: ["OSHA 30"] });
    const worker = makeWorker({ certifications: [{ id: "c1", name: "OSHA 30", issuer: "OSHA", issued_date: "2024-01-01T00:00:00.000Z", expiration_date: "2026-08-10T00:00:00.000Z", verified: true }] });
    const result = evaluateEligibility(requirement, { worker, ...makeContext() });
    expect(result.state).toBe("conditionally_eligible");
    expect(result.expiringSoonCertifications).toContain("OSHA 30");
  });

  it("blocks on a missing required language and passes when the worker speaks it", () => {
    const requirement = makeRequirement({ required_languages: ["Portuguese"] });
    expect(evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext() }).state).toBe("ineligible");
    expect(evaluateEligibility(requirement, { worker: makeWorker({ languages: ["en", "Portuguese"] }), ...makeContext() }).state).toBe("eligible");
  });

  it("blocks when the worker's experience level is below the required minimum", () => {
    const requirement = makeRequirement({ minimum_experience_level: "senior" });
    expect(evaluateEligibility(requirement, { worker: makeWorker({ experience_level: "entry" }), ...makeContext() }).state).toBe("ineligible");
    expect(evaluateEligibility(requirement, { worker: makeWorker({ experience_level: "expert" }), ...makeContext() }).state).toBe("eligible");
  });

  it("blocks when required equipment has no available instance anywhere", () => {
    const requirement = makeRequirement({ required_equipment_types: ["drone"] });
    const result = evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext() });
    expect(result.state).toBe("ineligible");
    expect(result.unavailableResources).toContain("equipment:drone");
  });

  it("blocks when required vehicle has no available instance anywhere", () => {
    const requirement = makeRequirement({ required_vehicle_types: ["van"] });
    const result = evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext() });
    expect(result.state).toBe("ineligible");
    expect(result.unavailableResources).toContain("vehicle:van");
  });

  it("blocks when the worker isn't on the required team", () => {
    const requirement = makeRequirement({ required_team_id: "team_1" });
    expect(evaluateEligibility(requirement, { worker: makeWorker({ team_id: "team_2" }), ...makeContext() }).state).toBe("ineligible");
    expect(evaluateEligibility(requirement, { worker: makeWorker({ team_id: "team_1" }), ...makeContext() }).state).toBe("eligible");
  });

  it("blocks an explicitly excluded worker", () => {
    const requirement = makeRequirement({ excluded_worker_ids: ["worker_1"] });
    const result = evaluateEligibility(requirement, { worker: makeWorker({ id: "worker_1" }), ...makeContext() });
    expect(result.state).toBe("ineligible");
  });

  it("blocks a worker whose team is explicitly excluded", () => {
    const requirement = makeRequirement({ excluded_team_ids: ["team_1"] });
    const result = evaluateEligibility(requirement, { worker: makeWorker({ team_id: "team_1" }), ...makeContext() });
    expect(result.state).toBe("ineligible");
  });

  it("blocks when distance exceeds the configured maximum", () => {
    const requirement = makeRequirement({ location_requirement: { latitude: 0, longitude: 0, label: null }, maximum_distance_km: 10 });
    const worker = makeWorker();
    const context = { worker, ...makeContext({ workerLocation: { worker_id: "worker_1", workspace_id: "ws_1", latitude: 50, longitude: 50, accuracy_meters: null, recorded_at: NOW, source: "mobile_app" as const } }) };
    const result = evaluateEligibility(requirement, context);
    expect(result.state).toBe("ineligible");
    expect(result.blockingReasons.some((r) => r.rule === "maximum_distance")).toBe(true);
  });

  it("is unknown (not ineligible) when distance can't be determined and a maximum is configured", () => {
    const requirement = makeRequirement({ location_requirement: { latitude: 0, longitude: 0, label: null }, maximum_distance_km: 10 });
    const result = evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext({ workerLocation: null }) });
    expect(result.state).toBe("unknown");
    expect(result.fallbacksUsed.length).toBeGreaterThan(0);
  });

  it("blocks on a duplicate active assignment to the same context", () => {
    const requirement = makeRequirement({ context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    const worker = makeWorker();
    const assignment = { id: "a1", workspace_id: "ws_1", worker_id: "worker_1", assignable_type: "event" as const, assignable_id: "event_1", role_note: null, status: "active" as const, starts_at: NOW, ends_at: null, created_by: "m1", created_at: NOW, updated_at: NOW };
    const result = evaluateEligibility(requirement, { worker, ...makeContext({ allActiveAssignments: [assignment] }) });
    expect(result.state).toBe("ineligible");
    expect(result.blockingReasons.some((r) => r.rule === "conflicting_assignment")).toBe(true);
  });

  it("blocks on a failing custom deterministic rule", () => {
    const requirement = makeRequirement({ custom_rules: [{ id: "rule_1", field: "worker_role", operator: "equals", value: "supervisor", description: "Must be a supervisor." }] });
    const result = evaluateEligibility(requirement, { worker: makeWorker({ role: "technician" }), ...makeContext() });
    expect(result.state).toBe("ineligible");
    expect(result.blockingReasons.some((r) => r.rule === "custom_rule:rule_1")).toBe(true);
  });

  it("passes a satisfying custom deterministic rule", () => {
    const requirement = makeRequirement({ custom_rules: [{ id: "rule_1", field: "worker_role", operator: "equals", value: "supervisor", description: "Must be a supervisor." }] });
    const result = evaluateEligibility(requirement, { worker: makeWorker({ role: "supervisor" }), ...makeContext() });
    expect(result.state).toBe("eligible");
  });
});

describe("evaluateEligibility — soft preferences never block", () => {
  it("an unmatched preferred skill/certification/language/equipment/vehicle never changes eligibility state", () => {
    const requirement = makeRequirement({ preferred_skills: ["Drone Piloting"], preferred_certifications: ["Advanced First Aid"], preferred_languages: ["French"], preferred_equipment_types: ["camera"], preferred_vehicle_types: ["truck"] });
    const result = evaluateEligibility(requirement, { worker: makeWorker(), ...makeContext() });
    expect(result.state).toBe("eligible");
    expect(result.unmatchedPreferences.length).toBeGreaterThan(0);
    expect(result.blockingReasons).toEqual([]);
  });
});
