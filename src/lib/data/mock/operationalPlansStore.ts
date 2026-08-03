import type { OperationalPlan, PlanStatus, PlanContextType, ExecutionPhase, Milestone, Deliverable, EvidenceRequirement, PlanChecklist, ApprovalRequirement } from "@/types/operationalPlanning";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.2 — Operational Plan persistence. A plan is one aggregate document — phases (with their own steps), milestones, deliverables, evidence requirements, checklists, and approvals all live inline, never as separately-queried child stores. Same `let` array + `resetXStore()` convention every mock store in this codebase uses. */
let plans: OperationalPlan[] = [];

export function resetOperationalPlansStore(): void {
  plans = [];
}

export interface CreateOperationalPlanInput {
  name: string;
  template_id: string | null;
  context_type: PlanContextType;
  context: KnowledgeNodeRef | null;
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
}

export type UpdateOperationalPlanInput = Partial<Pick<CreateOperationalPlanInput, "name" | "phases" | "milestones" | "deliverables" | "evidence_requirements" | "checklists" | "approvals">>;

async function listPlansForWorkspace(workspaceId: string, includeArchived = false): Promise<OperationalPlan[]> {
  return plans.filter((p) => p.workspace_id === workspaceId && (includeArchived || p.status !== "archived"));
}

async function getPlanById(id: string): Promise<OperationalPlan | null> {
  return plans.find((p) => p.id === id) ?? null;
}

async function createPlan(workspaceId: string, createdBy: string, input: CreateOperationalPlanInput): Promise<DataResult<OperationalPlan>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Plan name is required." });

  const timestamp = nowIso();
  const plan: OperationalPlan = {
    id: generateId("operational_plan"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    template_id: input.template_id,
    context_type: input.context_type,
    context: input.context,
    phases: input.phases,
    milestones: input.milestones,
    deliverables: input.deliverables,
    evidence_requirements: input.evidence_requirements,
    checklists: input.checklists,
    approvals: input.approvals,
    status: "draft",
    version: 1,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    approved_at: null,
    approved_by: null,
    archived_at: null,
  };
  plans = [...plans, plan];
  return ok(plan);
}

async function updatePlan(id: string, workspaceId: string, input: UpdateOperationalPlanInput): Promise<DataResult<OperationalPlan>> {
  const existing = plans.find((p) => p.id === id && p.workspace_id === workspaceId);
  if (!existing) return fail("This operational plan could not be found.");
  if (input.name !== undefined && !input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Plan name is required." });

  const updated: OperationalPlan = { ...existing, ...input, name: input.name?.trim() ?? existing.name, version: existing.version + 1, updated_at: nowIso() };
  plans = plans.map((p) => (p.id === id ? updated : p));
  return ok(updated);
}

async function setPlanStatus(id: string, workspaceId: string, status: PlanStatus, approvedBy: string | null): Promise<DataResult<OperationalPlan>> {
  const existing = plans.find((p) => p.id === id && p.workspace_id === workspaceId);
  if (!existing) return fail("This operational plan could not be found.");

  const timestamp = nowIso();
  const updated: OperationalPlan = {
    ...existing,
    status,
    updated_at: timestamp,
    approved_at: status === "approved" ? timestamp : existing.approved_at,
    approved_by: status === "approved" ? approvedBy : existing.approved_by,
    archived_at: status === "archived" ? timestamp : null,
  };
  plans = plans.map((p) => (p.id === id ? updated : p));
  return ok(updated);
}

export interface OperationalPlansRepository {
  listPlansForWorkspace: typeof listPlansForWorkspace;
  getPlanById: typeof getPlanById;
  createPlan: typeof createPlan;
  updatePlan: typeof updatePlan;
  setPlanStatus: typeof setPlanStatus;
}

export const mockOperationalPlansRepository: OperationalPlansRepository = {
  listPlansForWorkspace,
  getPlanById,
  createPlan,
  updatePlan,
  setPlanStatus,
};
