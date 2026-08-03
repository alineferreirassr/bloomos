"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getCoreOperationalPlansService,
  getCorePlanTemplatesService,
  getCoreChecklistTemplatesService,
  type CreatePlanTemplateInput,
  type UpdatePlanTemplateInput,
  type CreateChecklistTemplateInput,
} from "@/core/operationalPlanning";
import { getCoreAppointmentsService } from "@/core/scheduling";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { getEvents } from "@/lib/data";
import { detectDependencyCycle } from "@/core/operationalPlanning/executionStepEngine";
import { validateOperationalConstraints } from "@/core/operationalPlanning/operationalConstraintsEngine";
import { computeCriticalPath } from "@/core/operationalPlanning/criticalPathEngine";
import { computeOperationalHealthScores } from "@/core/operationalPlanning/operationalHealthEngine";
import { explainOperationalPlan } from "@/core/operationalPlanning/operationalExplanationEngine";
import { computeExecutionComplexity, compareOperationalPlans, type ComparisonPlanInput } from "@/core/operationalPlanning/operationalComparisonEngine";
import { pendingApprovals } from "@/core/operationalPlanning/approvalEngine";
import { buildProducesDeliverableRelationship } from "@/core/operationalPlanning/operationalKnowledgeGraphEngine";
import { detectOperationalRisks } from "@/core/operationalPlanning/operationalRiskEngine";
import { operationalFindingsToRecommendations } from "@/core/operationalPlanning/operationalFindingsEngine";
import { planCreatedEvent, planUpdatedEvent, planApprovedEvent, planArchivedEvent, phaseAddedEvent, stepAddedEvent, milestoneCompletedEvent, approvalRequiredEvent, deliverableAddedEvent, evidenceRequirementAddedEvent } from "@/core/operationalPlanning/operationalTimelineEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId, nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type {
  OperationalPlan,
  PlanTemplate,
  ChecklistTemplate,
  PlanContextType,
  ExecutionPhase,
  ExecutionPhaseKind,
  ExecutionStep,
  Milestone,
  Deliverable,
  EvidenceRequirement,
  PlanChecklist,
  ApprovalRequirement,
  ApprovalStatus,
  OperationalPlanResult,
  OperationalPlanComparisonResult,
  OperationalFinding,
  OperationalValidationResult,
} from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.2 — Operational Planning Platform module layer.
 * Determines HOW an operation should be executed — reusable plans only.
 * Never selects a resource (Allocation's job), never books a time
 * (Scheduling's job), never dispatches or executes a step. Composes
 * every engine this checkpoint built; the one cross-module read is
 * `checkMissingSchedule`, which looks at Checkpoint 27's real
 * `Appointment` data to answer "does this plan's context have a
 * schedule yet" — the one Step 11 check `OperationalConstraintsEngine`
 * itself can't answer, since it only sees a plan's own structure.
 */

const GENERIC_ACCESS_ERROR = "Operational Planning isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
/** A workspace-wide pattern, not a per-check threshold — a plan with low health but no blocking errors is still surfaced through `incomplete_plan` at the finding layer, not blocked here. */
const HEALTH_APPROVAL_THRESHOLD = 0;

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordOperationalTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function persistDeliverableRelationship(workspaceId: string, createdBy: string, planContext: KnowledgeNodeRef | null, deliverable: Deliverable): Promise<void> {
  const spec = buildProducesDeliverableRelationship(planContext, deliverable.linked_node);
  if (spec === null) return;
  await getCoreKnowledgeGraphService().createRelationship(workspaceId, createdBy, {
    sourceNodeType: spec.sourceNode.nodeType,
    sourceNodeId: spec.sourceNode.nodeId,
    targetNodeType: spec.targetNode.nodeType,
    targetNodeId: spec.targetNode.nodeId,
    relationshipType: spec.relationshipType,
    source: "user_action",
  });
}

async function syncOperationalPlanningKnowledgeGraph(workspaceId: string, createdBy: string, plan: OperationalPlan): Promise<void> {
  for (const deliverable of plan.deliverables) {
    await persistDeliverableRelationship(workspaceId, createdBy, plan.context, deliverable);
  }
}

// ---- Checklist Templates ----

export async function createChecklistTemplateAction(input: CreateChecklistTemplateInput): Promise<ActionResult<ChecklistTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreChecklistTemplatesService().createTemplate(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listChecklistTemplatesAction(includeArchived = false): Promise<ActionResult<ChecklistTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const templates = await getCoreChecklistTemplatesService().listTemplatesForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: templates };
}

export async function archiveChecklistTemplateAction(id: string): Promise<ActionResult<ChecklistTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreChecklistTemplatesService().setTemplateStatus(id, session.workspace.id, "archived");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function reactivateChecklistTemplateAction(id: string): Promise<ActionResult<ChecklistTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreChecklistTemplatesService().setTemplateStatus(id, session.workspace.id, "active");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

// ---- Plan Templates ----

export async function createPlanTemplateAction(input: CreatePlanTemplateInput): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCorePlanTemplatesService().createTemplate(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listPlanTemplatesAction(includeArchived = false): Promise<ActionResult<PlanTemplate[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const templates = await getCorePlanTemplatesService().listTemplatesForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: templates };
}

export async function getPlanTemplateAction(id: string): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = await getCorePlanTemplatesService().getTemplateById(id);
  if (!template || template.workspace_id !== session.workspace.id) return { success: false, error: "This plan template could not be found." };
  return { success: true, data: template };
}

export async function updatePlanTemplateAction(id: string, input: UpdatePlanTemplateInput): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCorePlanTemplatesService().updateTemplate(id, session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function archivePlanTemplateAction(id: string): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCorePlanTemplatesService().setTemplateStatus(id, session.workspace.id, "archived");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function reactivatePlanTemplateAction(id: string): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCorePlanTemplatesService().setTemplateStatus(id, session.workspace.id, "active");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function duplicatePlanTemplateAction(id: string): Promise<ActionResult<PlanTemplate>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCorePlanTemplatesService().duplicateTemplate(id, session.workspace.id, session.membership.id);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

// ---- Template -> Plan instantiation (deep copy, fresh ids, never a live reference) ----

interface PlanStructure {
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
}

function instantiatePlanStructureFromTemplate(template: PlanTemplate): PlanStructure {
  const phaseIdMap = new Map(template.phases.map((p) => [p.id, generateId("execution_phase")] as const));
  const stepIdMap = new Map(template.phases.flatMap((p) => p.steps).map((s) => [s.id, generateId("execution_step")] as const));
  const milestoneIdMap = new Map(template.milestones.map((m) => [m.id, generateId("milestone")] as const));
  const evidenceIdMap = new Map(template.evidence_requirements.map((e) => [e.id, generateId("evidence_requirement")] as const));
  const deliverableIdMap = new Map(template.deliverables.map((d) => [d.id, generateId("deliverable")] as const));
  const approvalIdMap = new Map(template.approvals.map((a) => [a.id, generateId("approval_requirement")] as const));

  const phases: ExecutionPhase[] = template.phases.map((phase) => ({
    id: phaseIdMap.get(phase.id) as string,
    kind: phase.kind,
    name: phase.name,
    order: phase.order,
    steps: phase.steps.map((step) => ({
      id: stepIdMap.get(step.id) as string,
      title: step.title,
      description: step.description,
      instructions: step.instructions,
      estimated_duration_minutes: step.estimated_duration_minutes,
      dependencies: step.dependencies.map((dep) => ({ step_id: stepIdMap.get(dep.step_id) ?? dep.step_id, type: dep.type, dependency_class: dep.dependency_class })),
      assigned_resource_type: step.assigned_resource_type,
      required_capability_requirement_id: step.required_capability_requirement_id,
      priority: step.priority,
      status: "pending",
      notes: step.notes,
    })),
  }));

  const milestones: Milestone[] = template.milestones.map((m) => ({
    id: milestoneIdMap.get(m.id) as string,
    title: m.title,
    target_phase_id: m.target_phase_id !== null ? (phaseIdMap.get(m.target_phase_id) ?? null) : null,
    completion_criteria: m.completion_criteria,
    evidence_requirement_ids: m.evidence_requirement_ids.map((id) => evidenceIdMap.get(id)).filter((id): id is string => id !== undefined),
    approval_required: m.approval_required,
    status: "not_started",
  }));

  const deliverables: Deliverable[] = template.deliverables.map((d) => ({
    id: deliverableIdMap.get(d.id) as string,
    title: d.title,
    type: d.type,
    description: d.description,
    produced_by_step_id: d.produced_by_step_id !== null ? (stepIdMap.get(d.produced_by_step_id) ?? null) : null,
    status: "pending",
    linked_node: null,
  }));

  const evidence_requirements: EvidenceRequirement[] = template.evidence_requirements.map((e) => ({
    id: evidenceIdMap.get(e.id) as string,
    type: e.type,
    description: e.description,
    step_id: e.step_id !== null ? (stepIdMap.get(e.step_id) ?? null) : null,
    milestone_id: e.milestone_id !== null ? (milestoneIdMap.get(e.milestone_id) ?? null) : null,
  }));

  const checklists: PlanChecklist[] = template.checklists.map((c) => ({
    id: generateId("plan_checklist"),
    template_id: c.template_id,
    name: c.name,
    kind: c.kind,
    items: c.items.map((item) => ({ id: generateId("checklist_item"), label: item.label, completed: false })),
  }));

  const approvals: ApprovalRequirement[] = template.approvals.map((a) => ({
    id: approvalIdMap.get(a.id) as string,
    type: a.type,
    description: a.description,
    phase_id: a.phase_id !== null ? (phaseIdMap.get(a.phase_id) ?? null) : null,
    step_id: a.step_id !== null ? (stepIdMap.get(a.step_id) ?? null) : null,
    milestone_id: a.milestone_id !== null ? (milestoneIdMap.get(a.milestone_id) ?? null) : null,
    status: "pending",
    approved_by: null,
    approved_at: null,
  }));

  return { phases, milestones, deliverables, evidence_requirements, checklists, approvals };
}

// ---- Operational Plans ----

export interface CreateOperationalPlanActionInput {
  name: string;
  template_id: string | null;
  context_type: PlanContextType;
  context: KnowledgeNodeRef | null;
}

export async function createOperationalPlanAction(input: CreateOperationalPlanActionInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  let structure: PlanStructure = { phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [] };
  if (input.template_id !== null) {
    const template = await getCorePlanTemplatesService().getTemplateById(input.template_id);
    if (!template || template.workspace_id !== workspaceId) return { success: false, error: "This plan template could not be found." };
    structure = instantiatePlanStructureFromTemplate(template);
  }

  const result = await getCoreOperationalPlansService().createPlan(workspaceId, session.membership.id, { name: input.name, template_id: input.template_id, context_type: input.context_type, context: input.context, ...structure });
  if (!result.success) return { success: false, error: result.error };

  recordOperationalTimelineEvent(workspaceId, result.data.context, planCreatedEvent(result.data.name));
  await syncOperationalPlanningKnowledgeGraph(workspaceId, session.membership.id, result.data);
  return { success: true, data: result.data };
}

export async function listOperationalPlansAction(includeArchived = false): Promise<ActionResult<OperationalPlan[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const plans = await getCoreOperationalPlansService().listPlansForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: plans };
}

export async function getOperationalPlanAction(id: string): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const plan = await getCoreOperationalPlansService().getPlanById(id);
  if (!plan || plan.workspace_id !== session.workspace.id) return { success: false, error: "This operational plan could not be found." };
  return { success: true, data: plan };
}

async function fetchPlanOrFail(id: string, workspaceId: string): Promise<{ plan: OperationalPlan } | { error: string }> {
  const plan = await getCoreOperationalPlansService().getPlanById(id);
  if (!plan || plan.workspace_id !== workspaceId) return { error: "This operational plan could not be found." };
  return { plan };
}

// ---- Plan structure mutations — each records its own named Timeline event ----

export interface AddPhaseInput {
  kind: ExecutionPhaseKind;
  name: string;
  order: number;
}

export async function addPhaseAction(planId: string, input: AddPhaseInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const newPhase: ExecutionPhase = { id: generateId("execution_phase"), kind: input.kind, name: input.name, order: input.order, steps: [] };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { phases: [...found.plan.phases, newPhase] });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, phaseAddedEvent(newPhase.name));
  return { success: true, data: result.data };
}

export type AddStepInput = Omit<ExecutionStep, "id" | "status">;

export async function addStepToPhaseAction(planId: string, phaseId: string, input: AddStepInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  if (!found.plan.phases.some((p) => p.id === phaseId)) return { success: false, error: "This execution phase could not be found." };

  const newStep: ExecutionStep = { ...input, id: generateId("execution_step"), status: "pending" };
  const phases = found.plan.phases.map((p) => (p.id === phaseId ? { ...p, steps: [...p.steps, newStep] } : p));
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { phases });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, stepAddedEvent(newStep.title));
  return { success: true, data: result.data };
}

export type AddMilestoneInput = Omit<Milestone, "id" | "status">;

export async function addMilestoneAction(planId: string, input: AddMilestoneInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const newMilestone: Milestone = { ...input, id: generateId("milestone"), status: "not_started" };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { milestones: [...found.plan.milestones, newMilestone] });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function completeMilestoneAction(planId: string, milestoneId: string): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  const milestone = found.plan.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return { success: false, error: "This milestone could not be found." };

  const milestones = found.plan.milestones.map((m) => (m.id === milestoneId ? { ...m, status: "completed" as const } : m));
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { milestones });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, milestoneCompletedEvent(milestone.title));
  return { success: true, data: result.data };
}

export type AddDeliverableInput = Omit<Deliverable, "id" | "status">;

export async function addDeliverableAction(planId: string, input: AddDeliverableInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const newDeliverable: Deliverable = { ...input, id: generateId("deliverable"), status: "pending" };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { deliverables: [...found.plan.deliverables, newDeliverable] });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, deliverableAddedEvent(newDeliverable.title));
  await persistDeliverableRelationship(workspaceId, session.membership.id, result.data.context, newDeliverable);
  return { success: true, data: result.data };
}

export type AddEvidenceRequirementInput = Omit<EvidenceRequirement, "id">;

export async function addEvidenceRequirementAction(planId: string, input: AddEvidenceRequirementInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const newEvidence: EvidenceRequirement = { ...input, id: generateId("evidence_requirement") };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { evidence_requirements: [...found.plan.evidence_requirements, newEvidence] });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, evidenceRequirementAddedEvent(newEvidence.description));
  return { success: true, data: result.data };
}

export type AddApprovalRequirementInput = Omit<ApprovalRequirement, "id" | "status" | "approved_by" | "approved_at">;

export async function addApprovalRequirementAction(planId: string, input: AddApprovalRequirementInput): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const newApproval: ApprovalRequirement = { ...input, id: generateId("approval_requirement"), status: "pending", approved_by: null, approved_at: null };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { approvals: [...found.plan.approvals, newApproval] });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, approvalRequiredEvent(newApproval.description));
  return { success: true, data: result.data };
}

export async function decideApprovalAction(planId: string, approvalId: string, decision: Extract<ApprovalStatus, "approved" | "rejected">): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  if (!found.plan.approvals.some((a) => a.id === approvalId)) return { success: false, error: "This approval requirement could not be found." };

  const timestamp = nowIso();
  const approvals = found.plan.approvals.map((a) => (a.id === approvalId ? { ...a, status: decision, approved_by: decision === "approved" ? session.membership.id : null, approved_at: decision === "approved" ? timestamp : null } : a));
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { approvals });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function attachChecklistFromTemplateAction(planId: string, checklistTemplateId: string): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };
  const template = await getCoreChecklistTemplatesService().getTemplateById(checklistTemplateId);
  if (!template || template.workspace_id !== workspaceId) return { success: false, error: "This checklist template could not be found." };

  const newChecklist: PlanChecklist = { id: generateId("plan_checklist"), template_id: template.id, name: template.name, kind: template.kind, items: template.items.map((item) => ({ id: generateId("checklist_item"), label: item.label, completed: false })) };
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { checklists: [...found.plan.checklists, newChecklist] });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function toggleChecklistItemAction(planId: string, checklistId: string, itemId: string, completed: boolean): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const checklists = found.plan.checklists.map((c) => (c.id === checklistId ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, completed } : i)) } : c));
  const result = await getCoreOperationalPlansService().updatePlan(planId, workspaceId, { checklists });
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

// ---- Evaluation (validation + health + explanation + critical path) ----

/** The one cross-module check `OperationalConstraintsEngine` can't do itself — is there a real, non-cancelled `Appointment` (Checkpoint 27) linked to this plan's own context? Appended as a non-blocking warning, never invented when the plan has no real context to check against. */
async function checkMissingSchedule(workspaceId: string, plan: OperationalPlan): Promise<{ rule: string; detail: string } | null> {
  if (plan.context === null) return null;
  const appointments = await getCoreAppointmentsService().listAppointmentsForWorkspace(workspaceId);
  const hasSchedule = appointments.some((a) => a.status !== "cancelled" && a.context !== null && a.context.nodeType === plan.context?.nodeType && a.context.nodeId === plan.context?.nodeId);
  if (hasSchedule) return null;
  return { rule: "missing_schedule", detail: `"${plan.name}"'s context has no scheduled appointment yet.` };
}

interface PlanAnalysis {
  validation: OperationalValidationResult;
  health: ReturnType<typeof computeOperationalHealthScores>;
  explanation: ReturnType<typeof explainOperationalPlan>;
  criticalPath: ReturnType<typeof computeCriticalPath>;
  complexity: number;
}

async function analyzePlan(workspaceId: string, plan: OperationalPlan): Promise<PlanAnalysis> {
  const constraintsInput = { phases: plan.phases, milestones: plan.milestones, deliverables: plan.deliverables, evidenceRequirements: plan.evidence_requirements, approvals: plan.approvals };
  const validation = validateOperationalConstraints(constraintsInput);
  const scheduleIssue = await checkMissingSchedule(workspaceId, plan);
  if (scheduleIssue) validation.warnings.push(scheduleIssue);

  const health = computeOperationalHealthScores({ phases: plan.phases, milestones: plan.milestones, deliverables: plan.deliverables, evidenceRequirements: plan.evidence_requirements, checklists: plan.checklists, approvals: plan.approvals });
  const criticalPath = detectDependencyCycle(plan.phases).hasCycle ? { criticalStepIds: [], blockingStepIds: [], parallelStepIds: [], optionalStepIds: [], estimatedCompletionMinutes: 0 } : computeCriticalPath(plan.phases);
  const explanation = explainOperationalPlan(validation, health, criticalPath, plan.milestones, plan.deliverables);
  const complexity = computeExecutionComplexity(plan.phases);

  return { validation, health, explanation, criticalPath, complexity };
}

export async function evaluateOperationalPlanAction(planId: string): Promise<ActionResult<OperationalPlanResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(planId, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  const analysis = await analyzePlan(workspaceId, found.plan);
  return { success: true, data: { plan: found.plan, validation: analysis.validation, health: analysis.health, explanation: analysis.explanation, criticalPath: analysis.criticalPath } };
}

async function setPlanStatusAction(id: string, status: "approved" | "archived"): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const found = await fetchPlanOrFail(id, workspaceId);
  if ("error" in found) return { success: false, error: found.error };

  if (status === "approved") {
    const analysis = await analyzePlan(workspaceId, found.plan);
    if (!analysis.validation.valid) return { success: false, error: "This plan has blocking issues and cannot be approved yet." };
    if (pendingApprovals(found.plan.approvals).length > HEALTH_APPROVAL_THRESHOLD) return { success: false, error: "This plan still has pending approval requirements." };
  }

  const result = await getCoreOperationalPlansService().setPlanStatus(id, workspaceId, status, status === "approved" ? session.membership.id : null);
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, status === "approved" ? planApprovedEvent(result.data.name) : planArchivedEvent(result.data.name));
  return { success: true, data: result.data };
}

export async function approvePlanAction(id: string): Promise<ActionResult<OperationalPlan>> {
  return setPlanStatusAction(id, "approved");
}

export async function archivePlanAction(id: string): Promise<ActionResult<OperationalPlan>> {
  return setPlanStatusAction(id, "archived");
}

/** A structural edit (adding a phase/step/etc.) already records its own specific Timeline event; this generic `plan_updated` is for the rare direct-rename/description-edit path. */
export async function renameOperationalPlanAction(id: string, name: string): Promise<ActionResult<OperationalPlan>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("operational_planning.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const result = await getCoreOperationalPlansService().updatePlan(id, workspaceId, { name });
  if (!result.success) return { success: false, error: result.error };
  recordOperationalTimelineEvent(workspaceId, result.data.context, planUpdatedEvent(result.data.name));
  return { success: true, data: result.data };
}

// ---- Comparison ----

export async function comparePlansAction(planIds: string[]): Promise<ActionResult<OperationalPlanComparisonResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const inputs: ComparisonPlanInput[] = [];
  for (const planId of planIds) {
    const found = await fetchPlanOrFail(planId, workspaceId);
    if ("error" in found) continue;
    const analysis = await analyzePlan(workspaceId, found.plan);
    inputs.push({ planId: found.plan.id, planName: found.plan.name, phases: found.plan.phases, deliverables: found.plan.deliverables, evidenceRequirements: found.plan.evidence_requirements, milestones: found.plan.milestones, health: analysis.health, criticalPath: analysis.criticalPath, validationErrorCount: analysis.validation.errors.length });
  }

  return { success: true, data: compareOperationalPlans(inputs) };
}

// ---- Workspace-wide evaluation (Operational Dashboard + Executive Integration) ----

export interface EvaluateOperationalPlanningHealthResult {
  plans: OperationalPlan[];
  findings: OperationalFinding[];
  healthByPlanId: Record<string, ReturnType<typeof computeOperationalHealthScores>>;
}

export async function evaluateOperationalPlanningHealthAction(): Promise<ActionResult<EvaluateOperationalPlanningHealthResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const plans = await getCoreOperationalPlansService().listPlansForWorkspace(workspaceId, false);

  const validationResultsByPlanId = new Map<string, OperationalValidationResult>();
  const healthByPlanId = new Map<string, ReturnType<typeof computeOperationalHealthScores>>();
  const complexityByPlanId = new Map<string, number>();
  for (const plan of plans) {
    const analysis = await analyzePlan(workspaceId, plan);
    validationResultsByPlanId.set(plan.id, analysis.validation);
    healthByPlanId.set(plan.id, analysis.health);
    complexityByPlanId.set(plan.id, analysis.complexity);
  }

  const events = await getEvents({});
  const eventIdsWithPlan = new Set(plans.filter((p) => p.context_type === "event" && p.context !== null).map((p) => p.context?.nodeId));
  const contextsWithoutPlan: KnowledgeNodeRef[] = events.filter((e) => !eventIdsWithPlan.has(e.id)).map((e) => ({ nodeType: "event" as const, nodeId: e.id }));

  const findings = detectOperationalRisks({ plans, validationResultsByPlanId, healthByPlanId, complexityByPlanId, contextsWithoutPlan });

  return { success: true, data: { plans, findings, healthByPlanId: Object.fromEntries(healthByPlanId) } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateOperationalPlanningHealthAction`'s findings into `OperationalRecommendation`s. */
export async function operationalPlanningRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateOperationalPlanningHealthAction();
  if (!result.success) return [];
  return operationalFindingsToRecommendations(result.data.findings, result.data.plans, session.workspace.id);
}
