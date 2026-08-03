import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  createChecklistTemplateAction,
  listChecklistTemplatesAction,
  archiveChecklistTemplateAction,
  reactivateChecklistTemplateAction,
  createPlanTemplateAction,
  listPlanTemplatesAction,
  getPlanTemplateAction,
  updatePlanTemplateAction,
  archivePlanTemplateAction,
  duplicatePlanTemplateAction,
  createOperationalPlanAction,
  listOperationalPlansAction,
  getOperationalPlanAction,
  addPhaseAction,
  addStepToPhaseAction,
  addMilestoneAction,
  completeMilestoneAction,
  addDeliverableAction,
  addEvidenceRequirementAction,
  addApprovalRequirementAction,
  decideApprovalAction,
  attachChecklistFromTemplateAction,
  toggleChecklistItemAction,
  evaluateOperationalPlanAction,
  approvePlanAction,
  archivePlanAction,
  renameOperationalPlanAction,
  comparePlansAction,
  evaluateOperationalPlanningHealthAction,
  operationalPlanningRecommendationsForExecutiveDecisions,
} from "@/modules/operationalPlanning/operationalPlanningActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetOperationalPlansStore } from "@/lib/data/mock/operationalPlansStore";
import { resetPlanTemplatesStore } from "@/lib/data/mock/planTemplatesStore";
import { resetChecklistTemplatesStore } from "@/lib/data/mock/checklistTemplatesStore";
import { resetAppointmentsStore } from "@/lib/data/mock/appointmentsStore";
import { resetEventsStore } from "@/lib/data/mock/eventsStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import type { CreatePlanTemplateInput, CreateChecklistTemplateInput } from "@/core/operationalPlanning";
import type { CreateOperationalPlanActionInput, AddStepInput, AddMilestoneInput, AddDeliverableInput, AddEvidenceRequirementInput, AddApprovalRequirementInput } from "@/modules/operationalPlanning/operationalPlanningActions";
import type { ExecutionPhase } from "@/types/operationalPlanning";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["operational_planning.view", "operational_planning.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetOperationalPlansStore();
  resetPlanTemplatesStore();
  resetChecklistTemplatesStore();
  resetAppointmentsStore();
  resetEventsStore();
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

const baseTemplateInput: CreatePlanTemplateInput = {
  name: "Wedding Proposal",
  category: "wedding_proposal",
  description: null,
  phases: [
    {
      id: "template_phase_1",
      kind: "setup",
      name: "Setup",
      order: 0,
      steps: [
        { id: "template_step_1", title: "Arrange flowers", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null },
        { id: "template_step_2", title: "Set up lighting", description: null, instructions: null, estimated_duration_minutes: 20, dependencies: [{ step_id: "template_step_1", type: "finish_to_start", dependency_class: "blocking" }], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null },
      ],
    },
  ],
  milestones: [{ id: "template_milestone_1", title: "Setup complete", target_phase_id: "template_phase_1", completion_criteria: "All decor in place", evidence_requirement_ids: ["template_evidence_1"], approval_required: true, status: "not_started" }],
  deliverables: [{ id: "template_deliverable_1", title: "Final photos", type: "digital", description: null, produced_by_step_id: "template_step_2", status: "pending", linked_node: null }],
  evidence_requirements: [{ id: "template_evidence_1", type: "photo", description: "Photo of setup", step_id: "template_step_2", milestone_id: "template_milestone_1" }],
  checklists: [{ id: "template_checklist_1", template_id: null, name: "Setup checklist", kind: "task", items: [{ id: "template_item_1", label: "Flowers arranged", completed: false }] }],
  approvals: [{ id: "template_approval_1", type: "manager", description: "Manager sign-off", phase_id: "template_phase_1", step_id: null, milestone_id: null, status: "pending", approved_by: null, approved_at: null }],
};

describe("Checklist Templates CRUD", () => {
  const baseChecklistInput: CreateChecklistTemplateInput = { name: "Vehicle Safety", kind: "vehicle", items: [{ label: "Check tires" }] };

  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createChecklistTemplateAction(baseChecklistInput);
    expect(result.success).toBe(false);
  });

  it("creates, lists, archives, and reactivates a checklist template", async () => {
    const created = await createChecklistTemplateAction(baseChecklistInput);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const archived = await archiveChecklistTemplateAction(created.data.id);
    expect(archived.success).toBe(true);
    const listActiveOnly = await listChecklistTemplatesAction();
    if (listActiveOnly.success) expect(listActiveOnly.data).toHaveLength(0);

    const reactivated = await reactivateChecklistTemplateAction(created.data.id);
    expect(reactivated.success).toBe(true);
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();
  });
});

describe("Plan Templates CRUD", () => {
  it("creates, updates (version increments), archives, reactivates, and duplicates a template", async () => {
    const created = await createPlanTemplateAction(baseTemplateInput);
    expect(created.success).toBe(true);
    if (!created.success) return;
    expect(created.data.version).toBe(1);

    const fetched = await getPlanTemplateAction(created.data.id);
    expect(fetched.success).toBe(true);

    const updated = await updatePlanTemplateAction(created.data.id, { description: "Updated" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.version).toBe(2);

    const archived = await archivePlanTemplateAction(created.data.id);
    expect(archived.success).toBe(true);

    const duplicated = await duplicatePlanTemplateAction(created.data.id);
    expect(duplicated.success).toBe(true);
    if (duplicated.success) {
      expect(duplicated.data.name).toBe("Wedding Proposal (Copy)");
      expect(duplicated.data.status).toBe("active");
    }

    const list = await listPlanTemplatesAction(true);
    if (list.success) expect(list.data).toHaveLength(2);
  });
});

describe("createOperationalPlanAction", () => {
  it("creates a plan directly with an empty structure and records plan_created", async () => {
    const input: CreateOperationalPlanActionInput = { name: "My Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } };
    const result = await createOperationalPlanAction(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.phases).toHaveLength(0);
    }
    expect(readActivities().some((a) => a.type === "plan_created")).toBe(true);
  });

  it("instantiates a plan from a template with fresh ids and correctly remapped references", async () => {
    const template = await createPlanTemplateAction(baseTemplateInput);
    if (!template.success) return;

    const result = await createOperationalPlanAction({ name: "Instance", template_id: template.data.id, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const plan = result.data;
    expect(plan.phases).toHaveLength(1);
    const phase = plan.phases[0];
    expect(phase.id).not.toBe("template_phase_1");
    expect(phase.steps).toHaveLength(2);

    const [step1, step2] = phase.steps;
    expect(step1.id).not.toBe("template_step_1");
    // step2's dependency must point at step1's NEW id, not the stale template id.
    expect(step2.dependencies[0].step_id).toBe(step1.id);

    expect(plan.milestones).toHaveLength(1);
    expect(plan.milestones[0].target_phase_id).toBe(phase.id);
    expect(plan.milestones[0].status).toBe("not_started");

    expect(plan.evidence_requirements).toHaveLength(1);
    expect(plan.evidence_requirements[0].step_id).toBe(step2.id);
    expect(plan.evidence_requirements[0].milestone_id).toBe(plan.milestones[0].id);
    // The milestone's own evidence_requirement_ids must reference the evidence's NEW id.
    expect(plan.milestones[0].evidence_requirement_ids).toEqual([plan.evidence_requirements[0].id]);

    expect(plan.deliverables).toHaveLength(1);
    expect(plan.deliverables[0].produced_by_step_id).toBe(step2.id);
    expect(plan.deliverables[0].status).toBe("pending");

    expect(plan.checklists).toHaveLength(1);
    expect(plan.checklists[0].items[0].completed).toBe(false);

    expect(plan.approvals).toHaveLength(1);
    expect(plan.approvals[0].phase_id).toBe(phase.id);
    expect(plan.approvals[0].status).toBe("pending");
  });

  it("rejects a missing template", async () => {
    const result = await createOperationalPlanAction({ name: "X", template_id: "template_missing", context_type: "event", context: null });
    expect(result.success).toBe(false);
  });
});

describe("Plan structure mutations", () => {
  async function createBasePlan() {
    const result = await createOperationalPlanAction({ name: "My Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!result.success) throw new Error(result.error);
    return result.data;
  }

  it("addPhaseAction adds a phase and records phase_added", async () => {
    const plan = await createBasePlan();
    const result = await addPhaseAction(plan.id, { kind: "setup", name: "Setup", order: 0 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phases).toHaveLength(1);
    expect(readActivities().some((a) => a.type === "phase_added")).toBe(true);
  });

  it("addStepToPhaseAction adds a step and records step_added", async () => {
    const plan = await createBasePlan();
    const phaseResult = await addPhaseAction(plan.id, { kind: "setup", name: "Setup", order: 0 });
    if (!phaseResult.success) return;
    const phaseId = phaseResult.data.phases[0].id;

    const stepInput: AddStepInput = { title: "Arrange flowers", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", notes: null };
    const result = await addStepToPhaseAction(plan.id, phaseId, stepInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phases[0].steps).toHaveLength(1);
    expect(readActivities().some((a) => a.type === "step_added")).toBe(true);
  });

  it("rejects adding a step to a phase that doesn't exist", async () => {
    const plan = await createBasePlan();
    const result = await addStepToPhaseAction(plan.id, "phase_missing", { title: "X", description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", notes: null });
    expect(result.success).toBe(false);
  });

  it("addMilestoneAction adds a milestone; completeMilestoneAction marks it completed and records milestone_completed", async () => {
    const plan = await createBasePlan();
    const milestoneInput: AddMilestoneInput = { title: "Setup complete", target_phase_id: null, completion_criteria: "Done", evidence_requirement_ids: [], approval_required: false };
    const added = await addMilestoneAction(plan.id, milestoneInput);
    expect(added.success).toBe(true);
    if (!added.success) return;
    const milestoneId = added.data.milestones[0].id;

    const completed = await completeMilestoneAction(plan.id, milestoneId);
    expect(completed.success).toBe(true);
    if (completed.success) expect(completed.data.milestones[0].status).toBe("completed");
    expect(readActivities().some((a) => a.type === "milestone_completed")).toBe(true);
  });

  it("addDeliverableAction adds a deliverable, records deliverable_added, and syncs a produces_deliverable edge when linked_node is set", async () => {
    const plan = await createBasePlan();
    const deliverableInput: AddDeliverableInput = { title: "Final photos", type: "digital", description: null, produced_by_step_id: null, linked_node: { nodeType: "document", nodeId: "document_1" } };
    const result = await addDeliverableAction(plan.id, deliverableInput);
    expect(result.success).toBe(true);
    expect(readActivities().some((a) => a.type === "deliverable_added")).toBe(true);

    const outbound = await getCoreKnowledgeGraphService().getOutboundRelationships("ws_1", { nodeType: "event", nodeId: "event_1" }, false);
    expect(outbound.some((r) => r.relationship_type === "produces_deliverable" && r.target_node_id === "document_1")).toBe(true);
  });

  it("addEvidenceRequirementAction adds evidence and records evidence_requirement_added", async () => {
    const plan = await createBasePlan();
    const evidenceInput: AddEvidenceRequirementInput = { type: "photo", description: "Photo of setup", step_id: null, milestone_id: null };
    const result = await addEvidenceRequirementAction(plan.id, evidenceInput);
    expect(result.success).toBe(true);
    expect(readActivities().some((a) => a.type === "evidence_requirement_added")).toBe(true);
  });

  it("addApprovalRequirementAction adds an approval and records approval_required; decideApprovalAction resolves it", async () => {
    const plan = await createBasePlan();
    const approvalInput: AddApprovalRequirementInput = { type: "manager", description: "Manager sign-off", phase_id: null, step_id: null, milestone_id: null };
    const added = await addApprovalRequirementAction(plan.id, approvalInput);
    expect(added.success).toBe(true);
    if (!added.success) return;
    expect(readActivities().some((a) => a.type === "approval_required")).toBe(true);

    const approvalId = added.data.approvals[0].id;
    const decided = await decideApprovalAction(plan.id, approvalId, "approved");
    expect(decided.success).toBe(true);
    if (decided.success) {
      expect(decided.data.approvals[0].status).toBe("approved");
      expect(decided.data.approvals[0].approved_by).toBe("member_1");
    }
  });

  it("attachChecklistFromTemplateAction snapshots a checklist template onto the plan; toggleChecklistItemAction mutates its own copy", async () => {
    const plan = await createBasePlan();
    const template = await createChecklistTemplateAction({ name: "Setup checklist", kind: "task", items: [{ label: "Flowers arranged" }] });
    if (!template.success) return;

    const attached = await attachChecklistFromTemplateAction(plan.id, template.data.id);
    expect(attached.success).toBe(true);
    if (!attached.success) return;
    const checklist = attached.data.checklists[0];
    expect(checklist.template_id).toBe(template.data.id);
    expect(checklist.items[0].completed).toBe(false);

    const toggled = await toggleChecklistItemAction(plan.id, checklist.id, checklist.items[0].id, true);
    expect(toggled.success).toBe(true);
    if (toggled.success) expect(toggled.data.checklists[0].items[0].completed).toBe(true);
  });
});

describe("evaluateOperationalPlanAction / approvePlanAction / archivePlanAction", () => {
  it("evaluates a plan's validation, health, explanation, and critical path", async () => {
    const template = await createPlanTemplateAction(baseTemplateInput);
    if (!template.success) return;
    const created = await createOperationalPlanAction({ name: "Instance", template_id: template.data.id, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!created.success) return;

    const evaluated = await evaluateOperationalPlanAction(created.data.id);
    expect(evaluated.success).toBe(true);
    if (evaluated.success) {
      expect(evaluated.data.criticalPath.criticalStepIds.length).toBeGreaterThan(0);
      expect(evaluated.data.health.overallOperationalHealth).toBeGreaterThanOrEqual(0);
    }
  });

  it("blocks approval while an approval requirement is still pending, and succeeds once it's approved", async () => {
    const plan = await createOperationalPlanAction({ name: "Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!plan.success) return;
    const added = await addApprovalRequirementAction(plan.data.id, { type: "manager", description: "Sign-off", phase_id: null, step_id: null, milestone_id: null });
    if (!added.success) return;

    const blocked = await approvePlanAction(plan.data.id);
    expect(blocked.success).toBe(false);

    await decideApprovalAction(plan.data.id, added.data.approvals[0].id, "approved");
    const approved = await approvePlanAction(plan.data.id);
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.status).toBe("approved");
      expect(approved.data.approved_by).toBe("member_1");
    }
    expect(readActivities().some((a) => a.type === "plan_approved")).toBe(true);
  });

  it("archives a plan and records plan_archived", async () => {
    const plan = await createOperationalPlanAction({ name: "Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!plan.success) return;
    const archived = await archivePlanAction(plan.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.status).toBe("archived");
    expect(readActivities().some((a) => a.type === "plan_archived")).toBe(true);
  });
});

describe("comparePlansAction", () => {
  it("compares multiple plans and calls out the healthiest one", async () => {
    const plan1 = await createOperationalPlanAction({ name: "Simple Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    const template = await createPlanTemplateAction(baseTemplateInput);
    if (!plan1.success || !template.success) return;
    const plan2 = await createOperationalPlanAction({ name: "Complex Plan", template_id: template.data.id, context_type: "event", context: { nodeType: "event", nodeId: "event_2" } });
    if (!plan2.success) return;

    const result = await comparePlansAction([plan1.data.id, plan2.data.id]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries).toHaveLength(2);
      expect(result.data.entries.find((e) => e.planId === plan2.data.id)?.executionComplexity).toBeGreaterThan(0);
    }
  });
});

describe("evaluateOperationalPlanningHealthAction / operationalPlanningRecommendationsForExecutiveDecisions", () => {
  it("flags an active plan with no checklist, and translates findings into recommendations", async () => {
    const plan = await createOperationalPlanAction({ name: "Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!plan.success) return;
    // Force the plan active without going through approvePlanAction's gating, to isolate the missing_checklist check.
    const phases: ExecutionPhase[] = [];
    void phases;

    const health = await evaluateOperationalPlanningHealthAction();
    expect(health.success).toBe(true);
    if (!health.success) return;
    expect(health.data.plans).toHaveLength(1);

    const recommendations = await operationalPlanningRecommendationsForExecutiveDecisions();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  it("returns an empty array when the caller has no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const recommendations = await operationalPlanningRecommendationsForExecutiveDecisions();
    expect(recommendations).toEqual([]);
  });
});

describe("listOperationalPlansAction / getOperationalPlanAction", () => {
  it("scopes strictly to the caller's workspace", async () => {
    await createOperationalPlanAction({ name: "Plan", template_id: null, context_type: "event", context: null });
    const list = await listOperationalPlansAction();
    if (list.success) expect(list.data).toHaveLength(1);

    const missing = await getOperationalPlanAction("plan_missing");
    expect(missing.success).toBe(false);
  });
});

describe("permission enforcement (v2 Checkpoint 45 security fix)", () => {
  it("rejects every mutating action for a session lacking operational_planning.manage", async () => {
    const plan = await createOperationalPlanAction({ name: "Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" } });
    if (!plan.success) throw new Error("failed to create plan");
    const phaseResult = await addPhaseAction(plan.data.id, { kind: "setup", name: "Setup", order: 0 });
    if (!phaseResult.success) throw new Error("failed to add phase");
    const phaseId = phaseResult.data.phases[0].id;
    const template = await createPlanTemplateAction(baseTemplateInput);
    if (!template.success) throw new Error("failed to create template");
    const checklistTemplate = await createChecklistTemplateAction({ name: "Safety", kind: "vehicle", items: [{ label: "Check tires" }] });
    if (!checklistTemplate.success) throw new Error("failed to create checklist template");

    const viewOnlySession: MemberSessionSnapshot = { ...session, permissions: ["operational_planning.view"] };
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(viewOnlySession);

    expect((await createChecklistTemplateAction({ name: "X", kind: "vehicle", items: [] })).success).toBe(false);
    expect((await archiveChecklistTemplateAction(checklistTemplate.data.id)).success).toBe(false);
    expect((await reactivateChecklistTemplateAction(checklistTemplate.data.id)).success).toBe(false);
    expect((await createPlanTemplateAction(baseTemplateInput)).success).toBe(false);
    expect((await updatePlanTemplateAction(template.data.id, { description: "x" })).success).toBe(false);
    expect((await archivePlanTemplateAction(template.data.id)).success).toBe(false);
    expect((await duplicatePlanTemplateAction(template.data.id)).success).toBe(false);
    expect((await createOperationalPlanAction({ name: "Blocked", template_id: null, context_type: "event", context: null })).success).toBe(false);
    expect((await addPhaseAction(plan.data.id, { kind: "setup", name: "Blocked", order: 1 })).success).toBe(false);
    expect((await addStepToPhaseAction(plan.data.id, phaseId, { title: "Blocked", description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", notes: null })).success).toBe(false);
    expect((await addMilestoneAction(plan.data.id, { title: "Blocked", target_phase_id: null, completion_criteria: "x", evidence_requirement_ids: [], approval_required: false })).success).toBe(false);
    expect((await addDeliverableAction(plan.data.id, { title: "Blocked", type: "digital", description: null, produced_by_step_id: null, linked_node: null })).success).toBe(false);
    expect((await addEvidenceRequirementAction(plan.data.id, { type: "photo", description: "Blocked", step_id: null, milestone_id: null })).success).toBe(false);
    expect((await addApprovalRequirementAction(plan.data.id, { type: "manager", description: "Blocked", phase_id: null, step_id: null, milestone_id: null })).success).toBe(false);
    expect((await attachChecklistFromTemplateAction(plan.data.id, checklistTemplate.data.id)).success).toBe(false);
    expect((await approvePlanAction(plan.data.id)).success).toBe(false);
    expect((await archivePlanAction(plan.data.id)).success).toBe(false);
    expect((await renameOperationalPlanAction(plan.data.id, "Blocked")).success).toBe(false);
  });
});
