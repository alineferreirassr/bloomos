import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createCapabilityRequirementAction,
  listCapabilityRequirementsAction,
  updateCapabilityRequirementAction,
  archiveCapabilityRequirementAction,
  duplicateCapabilityRequirementAction,
  evaluateCapabilityRequirementAction,
  evaluateWorkforceCapabilityCoverageAction,
  evaluateWorkerCapabilityAction,
} from "@/modules/capability/capabilityActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { createWorkerAction } from "@/modules/workforce/workforceActions";
import { resetCapabilityRequirementsStore } from "@/lib/data/mock/capabilityRequirementsStore";
import { resetCapabilityEvaluationSnapshotsStore } from "@/lib/data/mock/capabilityEvaluationSnapshotsStore";
import { resetWorkersStore } from "@/lib/data/mock/workersStore";
import { resetTeamsStore } from "@/lib/data/mock/teamsStore";
import { resetAvailabilityStore } from "@/lib/data/mock/availabilityStore";
import { resetAssignmentsStore } from "@/lib/data/mock/assignmentsStore";
import { resetEquipmentStore } from "@/lib/data/mock/equipmentStore";
import { resetVehiclesStore } from "@/lib/data/mock/vehiclesStore";
import { resetLocationStore } from "@/lib/data/mock/locationStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import type { CreateCapabilityRequirementInput } from "@/core/capability";
import type { CreateWorkerInput } from "@/core/workforce";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workforce.capabilities.view", "workforce.capabilities.manage", "workforce.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const noPermissionsSession: MemberSessionSnapshot = { ...session, permissions: [] };
const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["workforce.capabilities.view", "workforce.manage"] };

const baseWorkerInput: CreateWorkerInput = {
  first_name: "Ana",
  last_name: "Ferreira",
  email: "ana@example.com",
  phone: null,
  role: "technician",
  employment_type: "full_time",
  team_id: null,
  supervisor_worker_id: null,
  linked_member_id: null,
  time_zone: "America/Sao_Paulo",
  language: "en",
  languages: ["en"],
  profile_photo_url: null,
  emergency_contact: null,
  skills: [{ id: "s1", name: "Rigging", category: "install", level: "primary" }],
  certifications: [],
};

const baseRequirementInput: CreateCapabilityRequirementInput = {
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

function resetAll(): void {
  resetCapabilityRequirementsStore();
  resetCapabilityEvaluationSnapshotsStore();
  resetWorkersStore();
  resetTeamsStore();
  resetAvailabilityStore();
  resetAssignmentsStore();
  resetEquipmentStore();
  resetVehiclesStore();
  resetLocationStore();
  resetKnowledgeGraphStore();
  resetTimelineStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("createCapabilityRequirementAction / listCapabilityRequirementsAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createCapabilityRequirementAction(baseRequirementInput);
    expect(result.success).toBe(false);
  });

  it("creates a requirement and records capability_requirement_created", async () => {
    const result = await createCapabilityRequirementAction(baseRequirementInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
    expect(readActivities().some((a) => a.type === "capability_requirement_created")).toBe(true);
  });

  it("lists only this workspace's requirements", async () => {
    await createCapabilityRequirementAction(baseRequirementInput);
    const result = await listCapabilityRequirementsAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("archiveCapabilityRequirementAction / duplicateCapabilityRequirementAction", () => {
  it("archiving records capability_requirement_archived and excludes it from the default list", async () => {
    const created = await createCapabilityRequirementAction(baseRequirementInput);
    if (!created.success) return;
    const archived = await archiveCapabilityRequirementAction(created.data.id);
    expect(archived.success).toBe(true);
    expect(readActivities().some((a) => a.type === "capability_requirement_archived")).toBe(true);

    const list = await listCapabilityRequirementsAction();
    if (list.success) expect(list.data).toHaveLength(0);
  });

  it("duplicating copies every field with a new id", async () => {
    const created = await createCapabilityRequirementAction(baseRequirementInput);
    if (!created.success) return;
    const duplicate = await duplicateCapabilityRequirementAction(created.data.id);
    expect(duplicate.success).toBe(true);
    if (duplicate.success) {
      expect(duplicate.data.id).not.toBe(created.data.id);
      expect(duplicate.data.required_skills).toEqual(["Rigging"]);
    }
  });
});

describe("evaluateCapabilityRequirementAction", () => {
  it("evaluates a matching worker as eligible, ranks them #1, and records worker_became_eligible", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    expect(worker.success && requirement.success).toBe(true);
    if (!worker.success || !requirement.success) return;

    const result = await evaluateCapabilityRequirementAction(requirement.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.eligibleCount).toBe(1);
    expect(result.data.ranking[0].workerId).toBe(worker.data.id);
    expect(result.data.ranking[0].rank).toBe(1);
    expect(readActivities().some((a) => a.type === "worker_became_eligible")).toBe(true);
  });

  it("does not re-record a state-transition event on a second evaluation with an unchanged result", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    if (!worker.success || !requirement.success) return;

    await evaluateCapabilityRequirementAction(requirement.data.id);
    const firstCount = readActivities().filter((a) => a.type === "worker_became_eligible").length;
    await evaluateCapabilityRequirementAction(requirement.data.id);
    const secondCount = readActivities().filter((a) => a.type === "worker_became_eligible").length;
    expect(secondCount).toBe(firstCount);
  });

  it("evaluates a worker missing the required skill as ineligible with a real blocking reason", async () => {
    const worker = await createWorkerAction({ ...baseWorkerInput, skills: [] });
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    if (!worker.success || !requirement.success) return;

    const result = await evaluateCapabilityRequirementAction(requirement.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ineligibleCount).toBe(1);
    expect(result.data.ranking[0].eligibility.blockingReasons[0].rule).toBe("required_skill:Rigging");
  });

  it("syncs a real eligible_for Knowledge Graph relationship for a saved requirement with a real context node", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    if (!worker.success || !requirement.success) return;

    await evaluateCapabilityRequirementAction(requirement.data.id);
    const outbound = await getCoreKnowledgeGraphService().getOutboundRelationships("ws_1", { nodeType: "worker", nodeId: worker.data.id }, false);
    expect(outbound.some((r) => r.relationship_type === "eligible_for" && r.target_node_id === "event_1")).toBe(true);
    expect(outbound.some((r) => r.relationship_type === "evaluated_for")).toBe(true);
  });

  it("returns an error for a requirement that doesn't exist", async () => {
    const result = await evaluateCapabilityRequirementAction("capability_requirement_missing");
    expect(result.success).toBe(false);
  });
});

describe("evaluateWorkforceCapabilityCoverageAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateWorkforceCapabilityCoverageAction();
    expect(result.success).toBe(false);
  });

  it("returns a coherent report for an empty workspace", async () => {
    const result = await evaluateWorkforceCapabilityCoverageAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.coverage.availableWorkersCount).toBe(0);
    expect(result.data.risks).toEqual([]);
  });

  it("detects no_eligible_worker when a requirement has no matching worker", async () => {
    await createCapabilityRequirementAction(baseRequirementInput);
    const result = await evaluateWorkforceCapabilityCoverageAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.risks.some((r) => r.type === "no_eligible_worker")).toBe(true);
  });
});

describe("evaluateWorkerCapabilityAction", () => {
  it("returns an error for a worker that doesn't exist", async () => {
    const result = await evaluateWorkerCapabilityAction("worker_missing");
    expect(result.success).toBe(false);
  });

  it("groups requirements by this worker's eligibility state", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    if (!worker.success || !requirement.success) return;

    const result = await evaluateWorkerCapabilityAction(worker.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.eligibleRequirements).toHaveLength(1);
    expect(result.data.eligibleRequirements[0].requirement.id).toBe(requirement.data.id);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutation and the manual evaluation trigger for a session with no workforce.capabilities.manage permission", async () => {
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    expect(requirement.success).toBe(true);
    if (!requirement.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(noPermissionsSession);

    expect((await createCapabilityRequirementAction(baseRequirementInput)).success).toBe(false);
    expect((await updateCapabilityRequirementAction(requirement.data.id, { title: "Blocked" })).success).toBe(false);
    expect((await archiveCapabilityRequirementAction(requirement.data.id)).success).toBe(false);
    expect((await duplicateCapabilityRequirementAction(requirement.data.id)).success).toBe(false);
    expect((await evaluateCapabilityRequirementAction(requirement.data.id)).success).toBe(false);
  });

  it("still returns a fully populated coverage/risk report for a workforce.capabilities.view-only session (no .manage) — the internal evaluation helper bypasses the gated public action", async () => {
    const worker = await createWorkerAction(baseWorkerInput);
    const requirement = await createCapabilityRequirementAction(baseRequirementInput);
    expect(worker.success && requirement.success).toBe(true);
    if (!worker.success || !requirement.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    const result = await evaluateWorkforceCapabilityCoverageAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.evaluationResults).toHaveLength(1);
    expect(result.data.evaluationResults[0].eligibleCount).toBe(1);
  });
});
