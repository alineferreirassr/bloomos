import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockCapabilityRequirementsRepository, resetCapabilityRequirementsStore, type CreateCapabilityRequirementInput } from "@/lib/data/mock/capabilityRequirementsStore";

const baseInput: CreateCapabilityRequirementInput = {
  title: "Lead Rigger",
  description: null,
  context_type: "event",
  context: { nodeType: "event", nodeId: "event_1" },
  required_skills: ["Rigging"],
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
};

beforeEach(() => resetCapabilityRequirementsStore());
afterEach(() => resetCapabilityRequirementsStore());

describe("mockCapabilityRequirementsRepository", () => {
  it("creates a requirement, not archived", async () => {
    const result = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.archived_at).toBeNull();
  });

  it("rejects a blank title", async () => {
    const result = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", { ...baseInput, title: " " });
    expect(result.success).toBe(false);
  });

  it("lists requirements scoped to the workspace, excluding archived by default", async () => {
    const created = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    await mockCapabilityRequirementsRepository.createRequirement("ws_2", "member_1", baseInput);
    if (created.success) await mockCapabilityRequirementsRepository.archiveRequirement(created.data.id, "ws_1");

    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1")).toEqual([]);
    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1", { includeArchived: true })).toHaveLength(1);
  });

  it("filters by contextType, requiredSkill, requiredCertification, teamId", async () => {
    await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", { ...baseInput, context_type: "client", context: { nodeType: "client", nodeId: "client_1" }, required_skills: ["Photography"], required_certifications: ["Drone License"], required_team_id: "team_1" });

    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1", { contextType: "client" })).toHaveLength(1);
    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1", { requiredSkill: "Rigging" })).toHaveLength(1);
    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1", { requiredCertification: "Drone License" })).toHaveLength(1);
    expect(await mockCapabilityRequirementsRepository.listRequirementsForWorkspace("ws_1", { teamId: "team_1" })).toHaveLength(1);
  });

  it("archiveRequirement sets archived_at", async () => {
    const created = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const archived = await mockCapabilityRequirementsRepository.archiveRequirement(created.data.id, "ws_1");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
  });

  it("duplicateRequirement copies fields with a new id and (Copy) suffix", async () => {
    const created = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const duplicate = await mockCapabilityRequirementsRepository.duplicateRequirement(created.data.id, "ws_1", "member_2");
    expect(duplicate.success).toBe(true);
    if (duplicate.success) {
      expect(duplicate.data.id).not.toBe(created.data.id);
      expect(duplicate.data.title).toBe("Lead Rigger (Copy)");
      expect(duplicate.data.required_skills).toEqual(["Rigging"]);
    }
  });

  it("updateRequirement rejects clearing the title to blank", async () => {
    const created = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const result = await mockCapabilityRequirementsRepository.updateRequirement(created.data.id, "ws_1", { title: "  " });
    expect(result.success).toBe(false);
  });

  it("fails to archive a requirement in a different workspace", async () => {
    const created = await mockCapabilityRequirementsRepository.createRequirement("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const result = await mockCapabilityRequirementsRepository.archiveRequirement(created.data.id, "ws_2");
    expect(result.success).toBe(false);
  });
});
