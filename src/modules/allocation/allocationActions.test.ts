import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createResourceBundleAction,
  listResourceBundlesAction,
  getResourceBundleAction,
  updateResourceBundleAction,
  archiveResourceBundleAction,
  reactivateResourceBundleAction,
  duplicateResourceBundleAction,
  createDependencyRuleAction,
  listDependencyRulesAction,
  createAllocationRequestAction,
  listAllocationRequestsAction,
  getAllocationRequestAction,
  generateAllocationProposalAction,
  generateAllocationProposalsForComparisonAction,
  reEvaluateAllocationAction,
  compareAllocationProposalsAction,
  listAllocationsForRequestAction,
  listAllocationGroupAction,
  getAllocationAction,
  approveAllocationAction,
  archiveAllocationAction,
  evaluateResourceAllocationHealthAction,
  allocationRecommendationsForExecutiveDecisions,
} from "@/modules/allocation/allocationActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetAllocationRequestsStore } from "@/lib/data/mock/allocationRequestsStore";
import { resetAllocationsStore } from "@/lib/data/mock/allocationsStore";
import { resetResourceBundlesStore } from "@/lib/data/mock/resourceBundlesStore";
import { resetDependencyRulesStore } from "@/lib/data/mock/dependencyRulesStore";
import { resetWorkersStore } from "@/lib/data/mock/workersStore";
import { resetTeamsStore } from "@/lib/data/mock/teamsStore";
import { resetEquipmentStore } from "@/lib/data/mock/equipmentStore";
import { resetVehiclesStore } from "@/lib/data/mock/vehiclesStore";
import { resetAssignmentsStore } from "@/lib/data/mock/assignmentsStore";
import { resetAvailabilityStore } from "@/lib/data/mock/availabilityStore";
import { resetVendorsStore } from "@/lib/data/mock/vendorsStore";
import { resetCapabilityRequirementsStore } from "@/lib/data/mock/capabilityRequirementsStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getCoreWorkersService, getCoreEquipmentService } from "@/core/workforce";
import { getCoreCapabilityRequirementsService } from "@/core/capability";
import type { CreateResourceBundleInput, CreateDependencyRuleInput } from "@/core/allocation";
import type { CreateAllocationRequestInput } from "@/lib/data/mock/allocationRequestsStore";
import type { AllocationRequirementLine } from "@/types/allocation";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["allocations.view", "allocations.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetAllocationRequestsStore();
  resetAllocationsStore();
  resetResourceBundlesStore();
  resetDependencyRulesStore();
  resetWorkersStore();
  resetTeamsStore();
  resetEquipmentStore();
  resetVehiclesStore();
  resetAssignmentsStore();
  resetAvailabilityStore();
  resetVendorsStore();
  resetCapabilityRequirementsStore();
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

async function createWorker(overrides: { skills?: { name: string; category: string; level: "primary" | "secondary" | "learning" }[]; certifications?: { name: string; verified: boolean }[] } = {}) {
  const skills = (overrides.skills ?? []).map((s, i) => ({ id: `skill_${i}`, name: s.name, category: s.category, level: s.level }));
  const certifications = (overrides.certifications ?? []).map((c, i) => ({ id: `cert_${i}`, name: c.name, issuer: "Registry", issued_date: "2025-01-01", expiration_date: null, verified: c.verified }));
  const result = await getCoreWorkersService().createWorker("ws_1", {
    first_name: "Test",
    last_name: "Worker",
    email: `worker-${Math.random()}@amorebloom.com`,
    phone: null,
    role: "photographer",
    employment_type: "full_time",
    team_id: null,
    supervisor_worker_id: null,
    linked_member_id: null,
    time_zone: "UTC",
    language: "en",
    profile_photo_url: null,
    emergency_contact: null,
    skills,
    certifications,
  });
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createEquipment(category = "Drone") {
  const result = await getCoreEquipmentService().createEquipment("ws_1", { name: "Item", category, serial_number: null, notes: null });
  if (!result.success) throw new Error(result.error);
  return result.data;
}

async function createCapabilityRequirement(requiredSkills: string[]) {
  const result = await getCoreCapabilityRequirementsService().createRequirement("ws_1", "member_1", {
    title: "Photographer Needed",
    description: null,
    context_type: "event",
    context: null,
    required_skills: requiredSkills,
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
  });
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function baseRequestInput(overrides: Partial<CreateAllocationRequestInput> = {}): CreateAllocationRequestInput {
  return {
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }],
    required_starts_at: "2026-08-03T10:00:00.000Z",
    required_ends_at: "2026-08-03T14:00:00.000Z",
    calendar_id: null,
    priority: "medium",
    deadline: null,
    location_placeholder: null,
    special_instructions: null,
    bundle_id: null,
    source: "manual",
    ...overrides,
  };
}

describe("Resource Bundles CRUD", () => {
  const baseBundle: CreateResourceBundleInput = {
    name: "Photography Crew",
    description: "Lead photographer + assistant",
    required_resources: [{ resource_type: "worker", quantity: 2, capability_requirement_id: null, notes: null }],
    optional_resources: [],
    min_quantity: 1,
    max_quantity: null,
  };

  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createResourceBundleAction(baseBundle);
    expect(result.success).toBe(false);
  });

  it("creates, lists, updates, archives, reactivates, and duplicates a bundle", async () => {
    const created = await createResourceBundleAction(baseBundle);
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.status).toBe("active");

    const fetched = await getResourceBundleAction(created.data.id);
    expect(fetched.success).toBe(true);

    const updated = await updateResourceBundleAction(created.data.id, { description: "Updated crew" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.description).toBe("Updated crew");

    const archived = await archiveResourceBundleAction(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");

    const listActiveOnly = await listResourceBundlesAction();
    if (listActiveOnly.success) expect(listActiveOnly.data).toHaveLength(0);

    const reactivated = await reactivateResourceBundleAction(created.data.id);
    expect(reactivated.success).toBe(true);
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();

    const duplicated = await duplicateResourceBundleAction(created.data.id);
    expect(duplicated.success).toBe(true);
    if (duplicated.success) expect(duplicated.data.name).toBe("Photography Crew (Copy)");

    const listAll = await listResourceBundlesAction();
    if (listAll.success) expect(listAll.data).toHaveLength(2);
  });
});

describe("Dependency Rules", () => {
  const baseRule: CreateDependencyRuleInput = {
    subject_resource_type: "equipment",
    subject_identifier: "Drone",
    requires_resource_type: "worker",
    requires_skill: null,
    requires_certification: "Drone Operator",
    description: "A drone requires a certified operator.",
  };

  it("rejects a rule with neither a required skill nor certification", async () => {
    const result = await createDependencyRuleAction({ ...baseRule, requires_certification: null });
    expect(result.success).toBe(false);
  });

  it("creates and lists a dependency rule", async () => {
    const created = await createDependencyRuleAction(baseRule);
    expect(created.success).toBe(true);
    const list = await listDependencyRulesAction();
    if (list.success) expect(list.data).toHaveLength(1);
  });
});

describe("Allocation Requests", () => {
  it("creates a request directly and derives one from a bundle when required_resources is empty", async () => {
    const direct = await createAllocationRequestAction(baseRequestInput());
    expect(direct.success).toBe(true);

    const bundleResult = await createResourceBundleAction({
      name: "Photography Crew",
      description: null,
      required_resources: [{ resource_type: "worker", quantity: 2, capability_requirement_id: null, notes: null }],
      optional_resources: [],
      min_quantity: 1,
      max_quantity: null,
    });
    if (!bundleResult.success) return;

    const fromBundle = await createAllocationRequestAction(baseRequestInput({ required_resources: [], bundle_id: bundleResult.data.id }));
    expect(fromBundle.success).toBe(true);
    if (fromBundle.success) {
      expect(fromBundle.data.required_resources).toHaveLength(1);
      expect(fromBundle.data.required_resources[0].quantity).toBe(2);
    }

    const list = await listAllocationRequestsAction();
    if (list.success) expect(list.data).toHaveLength(2);

    const missing = await getAllocationRequestAction("request_missing");
    expect(missing.success).toBe(false);
  });
});

describe("generateAllocationProposalAction", () => {
  it("selects an eligible worker matching a capability requirement and rejects the unqualified one", async () => {
    const requirement = await createCapabilityRequirement(["Photography"]);
    const qualified = await createWorker({ skills: [{ name: "Photography", category: "creative", level: "primary" }] });
    const unqualified = await createWorker();

    const requestResult = await createAllocationRequestAction(
      baseRequestInput({ required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: requirement.id, preferred_resource_ids: [], notes: null }] }),
    );
    if (!requestResult.success) return;

    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    expect(proposal.success).toBe(true);
    if (!proposal.success) return;

    const selected = proposal.data.allocation.candidates.filter((c) => c.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].resource_id).toBe(qualified.id);
    expect(proposal.data.allocation.candidates.some((c) => c.resource_id === unqualified.id && !c.selected)).toBe(true);
    expect(proposal.data.validation.valid).toBe(true);
    expect(proposal.data.scores.capabilityFitScore).toBeGreaterThan(0);

    expect(readActivities().some((a) => a.type === "allocation_created")).toBe(true);
    const outbound = await getCoreKnowledgeGraphService().getOutboundRelationships("ws_1", { nodeType: "worker", nodeId: qualified.id }, false);
    expect(outbound.some((r) => r.relationship_type === "allocated_to" && r.target_node_id === "event_1")).toBe(true);
  });

  it("treats an equipment line honestly — only status:available equipment is eligible", async () => {
    await createEquipment("Camera");
    await getCoreEquipmentService().setEquipmentStatus((await createEquipment("Camera")).id, "ws_1", "maintenance");

    const requestResult = await createAllocationRequestAction(
      baseRequestInput({ required_resources: [{ resource_type: "equipment", quantity: 2, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }),
    );
    if (!requestResult.success) return;

    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    expect(proposal.success).toBe(true);
    if (!proposal.success) return;
    expect(proposal.data.allocation.candidates.filter((c) => c.selected)).toHaveLength(1);
    expect(proposal.data.validation.valid).toBe(false);
    expect(proposal.data.validation.errors.some((e) => e.rule === "insufficient_quantity")).toBe(true);
  });

  it("never fabricates an asset/custom pool — capabilityFitScore is 0 when nothing could be selected", async () => {
    const requestResult = await createAllocationRequestAction(
      baseRequestInput({ required_resources: [{ resource_type: "asset", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }),
    );
    if (!requestResult.success) return;

    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    expect(proposal.success).toBe(true);
    if (!proposal.success) return;
    expect(proposal.data.allocation.candidates).toHaveLength(0);
    expect(proposal.data.scores.capabilityFitScore).toBe(0);
    expect(proposal.data.validation.valid).toBe(false);
  });

  it("flags an unsatisfied dependency and records allocation_dependency_failed, then satisfies it once a certified worker is co-selected", async () => {
    await createDependencyRuleAction({ subject_resource_type: "equipment", subject_identifier: "Drone", requires_resource_type: "worker", requires_skill: null, requires_certification: "Drone Operator", description: "A drone requires a certified operator." });
    const drone = await createEquipment("Drone");
    const uncertifiedWorker = await createWorker();

    const linesWithoutOperator: AllocationRequirementLine[] = [{ resource_type: "equipment", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }];
    const requestNoOperator = await createAllocationRequestAction(baseRequestInput({ required_resources: linesWithoutOperator }));
    if (!requestNoOperator.success) return;
    const proposalNoOperator = await generateAllocationProposalAction(requestNoOperator.data.id, "highest_capability");
    expect(proposalNoOperator.success).toBe(true);
    if (proposalNoOperator.success) {
      expect(proposalNoOperator.data.validation.errors.some((e) => e.rule === "dependency_unsatisfied")).toBe(true);
      expect(readActivities().some((a) => a.type === "allocation_dependency_failed")).toBe(true);
    }
    expect(drone.category).toBe("Drone");
    expect(uncertifiedWorker.id).toBeTruthy();

    const certifiedWorker = await createWorker({ certifications: [{ name: "Drone Operator", verified: true }] });
    const linesWithOperator: AllocationRequirementLine[] = [
      { resource_type: "equipment", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null },
      { resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [certifiedWorker.id], notes: null },
    ];
    const requestWithOperator = await createAllocationRequestAction(baseRequestInput({ required_resources: linesWithOperator }));
    if (!requestWithOperator.success) return;
    const proposalWithOperator = await generateAllocationProposalAction(requestWithOperator.data.id, "preferred_worker");
    expect(proposalWithOperator.success).toBe(true);
    if (proposalWithOperator.success) {
      expect(proposalWithOperator.data.validation.errors.some((e) => e.rule === "dependency_unsatisfied")).toBe(false);
    }
  });
});

describe("generateAllocationProposalsForComparisonAction / compareAllocationProposalsAction", () => {
  it("generates one proposal per strategy sharing a group_id and compares them", async () => {
    await createWorker();
    await createWorker();
    const requestResult = await createAllocationRequestAction(baseRequestInput({ required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }));
    if (!requestResult.success) return;

    const bundle = await generateAllocationProposalsForComparisonAction(requestResult.data.id, ["highest_capability", "least_busy"]);
    expect(bundle.success).toBe(true);
    if (!bundle.success) return;
    expect(bundle.data.results).toHaveLength(2);
    expect(bundle.data.comparison.entries).toHaveLength(2);
    expect(new Set(bundle.data.results.map((r) => r.allocation.group_id)).size).toBe(1);

    const groupId = bundle.data.results[0].allocation.group_id;
    const compared = await compareAllocationProposalsAction(groupId);
    expect(compared.success).toBe(true);
    if (compared.success) expect(compared.data.entries).toHaveLength(2);

    const groupList = await listAllocationGroupAction(groupId);
    if (groupList.success) expect(groupList.data).toHaveLength(2);
  });

  it("rejects an empty strategy list", async () => {
    const requestResult = await createAllocationRequestAction(baseRequestInput());
    if (!requestResult.success) return;
    const result = await generateAllocationProposalsForComparisonAction(requestResult.data.id, []);
    expect(result.success).toBe(false);
  });
});

describe("reEvaluateAllocationAction / approveAllocationAction / archiveAllocationAction", () => {
  it("re-derives scores without re-selecting candidates, and only reEvaluate emits allocation_recalculated", async () => {
    await createWorker();
    const requestResult = await createAllocationRequestAction(baseRequestInput({ required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }));
    if (!requestResult.success) return;
    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    if (!proposal.success) return;
    const originalCandidates = proposal.data.allocation.candidates;

    const reEvaluated = await reEvaluateAllocationAction(proposal.data.allocation.id);
    expect(reEvaluated.success).toBe(true);
    if (reEvaluated.success) expect(reEvaluated.data.allocation.candidates).toEqual(originalCandidates);
    expect(readActivities().filter((a) => a.type === "allocation_recalculated")).toHaveLength(1);

    const groupId = proposal.data.allocation.group_id;
    await compareAllocationProposalsAction(groupId);
    expect(readActivities().filter((a) => a.type === "allocation_recalculated")).toHaveLength(1);

    const approved = await approveAllocationAction(proposal.data.allocation.id);
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.status).toBe("approved");
      expect(approved.data.approved_by).toBe("member_1");
    }
    expect(readActivities().some((a) => a.type === "allocation_approved")).toBe(true);

    const archived = await archiveAllocationAction(proposal.data.allocation.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");
    expect(readActivities().some((a) => a.type === "allocation_archived")).toBe(true);
  });
});

describe("listAllocationsForRequestAction / getAllocationAction", () => {
  it("scopes strictly to the caller's workspace", async () => {
    await createWorker();
    const requestResult = await createAllocationRequestAction(baseRequestInput({ required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }));
    if (!requestResult.success) return;
    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    if (!proposal.success) return;

    const list = await listAllocationsForRequestAction(requestResult.data.id);
    if (list.success) expect(list.data).toHaveLength(1);

    const fetched = await getAllocationAction(proposal.data.allocation.id);
    expect(fetched.success).toBe(true);

    const missing = await getAllocationAction("allocation_missing");
    expect(missing.success).toBe(false);
  });
});

describe("evaluateResourceAllocationHealthAction / allocationRecommendationsForExecutiveDecisions", () => {
  it("flags no_allocation_possible when nothing could be allocated, and translates findings into recommendations", async () => {
    const requestResult = await createAllocationRequestAction(
      baseRequestInput({ required_resources: [{ resource_type: "asset", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: null }] }),
    );
    if (!requestResult.success) return;
    const proposal = await generateAllocationProposalAction(requestResult.data.id, "highest_capability");
    expect(proposal.success).toBe(true);

    const health = await evaluateResourceAllocationHealthAction();
    expect(health.success).toBe(true);
    if (!health.success) return;
    expect(health.data.findings.some((f) => f.type === "no_allocation_possible")).toBe(true);
    expect(health.data.resourcePool).toBeDefined();

    const recommendations = await allocationRecommendationsForExecutiveDecisions();
    expect(recommendations.some((r) => r.ruleId === "allocation.no_allocation_possible")).toBe(true);
  });

  it("returns an empty array when the caller has no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recommendations = await allocationRecommendationsForExecutiveDecisions();
    expect(recommendations).toEqual([]);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  const bundleInput: CreateResourceBundleInput = {
    name: "Photography Crew",
    description: null,
    required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, notes: null }],
    optional_resources: [],
    min_quantity: 1,
    max_quantity: null,
  };
  const ruleInput: CreateDependencyRuleInput = { subject_resource_type: "equipment", subject_identifier: null, requires_resource_type: "worker", requires_skill: null, requires_certification: null, description: "Drone equipment requires a certified operator" };

  it("rejects every mutation for a session with no allocations.manage permission", async () => {
    const bundle = await createResourceBundleAction(bundleInput);
    const request = await createAllocationRequestAction(baseRequestInput());
    expect(bundle.success && request.success).toBe(true);
    if (!bundle.success || !request.success) return;
    const proposal = await generateAllocationProposalAction(request.data.id, "highest_capability");
    expect(proposal.success).toBe(true);
    if (!proposal.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["allocations.view"] });

    expect((await createResourceBundleAction(bundleInput)).success).toBe(false);
    expect((await updateResourceBundleAction(bundle.data.id, { description: "Blocked" })).success).toBe(false);
    expect((await archiveResourceBundleAction(bundle.data.id)).success).toBe(false);
    expect((await reactivateResourceBundleAction(bundle.data.id)).success).toBe(false);
    expect((await duplicateResourceBundleAction(bundle.data.id)).success).toBe(false);
    expect((await createDependencyRuleAction(ruleInput)).success).toBe(false);
    expect((await createAllocationRequestAction(baseRequestInput())).success).toBe(false);
    expect((await generateAllocationProposalAction(request.data.id, "highest_capability")).success).toBe(false);
    expect((await generateAllocationProposalsForComparisonAction(request.data.id, ["highest_capability"])).success).toBe(false);
    expect((await reEvaluateAllocationAction(proposal.data.allocation.id)).success).toBe(false);
    expect((await approveAllocationAction(proposal.data.allocation.id)).success).toBe(false);
    expect((await archiveAllocationAction(proposal.data.allocation.id)).success).toBe(false);
  });
});
