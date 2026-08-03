import type { PlanTemplate, TemplateCategory, TemplateStatus, ExecutionPhase, Milestone, Deliverable, EvidenceRequirement, PlanChecklist, ApprovalRequirement } from "@/types/operationalPlanning";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.2, Step 2 — Plan Template Registry persistence. A reusable structure (phases/steps/milestones/deliverables/evidence/checklists/approvals) that `OperationalPlanEngine` deep-copies into a fresh `OperationalPlan` — never a live reference. Same convention as `resourceBundlesStore.ts`. */
let templates: PlanTemplate[] = [];

export function resetPlanTemplatesStore(): void {
  templates = [];
}

export interface CreatePlanTemplateInput {
  name: string;
  category: TemplateCategory;
  description: string | null;
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  evidence_requirements: EvidenceRequirement[];
  checklists: PlanChecklist[];
  approvals: ApprovalRequirement[];
}

export type UpdatePlanTemplateInput = Partial<CreatePlanTemplateInput>;

async function listTemplatesForWorkspace(workspaceId: string, includeArchived = false): Promise<PlanTemplate[]> {
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.status === "active"));
}

async function getTemplateById(id: string): Promise<PlanTemplate | null> {
  return templates.find((t) => t.id === id) ?? null;
}

async function createTemplate(workspaceId: string, createdBy: string, input: CreatePlanTemplateInput): Promise<DataResult<PlanTemplate>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Template name is required." });

  const timestamp = nowIso();
  const template: PlanTemplate = {
    id: generateId("plan_template"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    category: input.category,
    description: input.description,
    phases: input.phases,
    milestones: input.milestones,
    deliverables: input.deliverables,
    evidence_requirements: input.evidence_requirements,
    checklists: input.checklists,
    approvals: input.approvals,
    version: 1,
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  templates = [...templates, template];
  return ok(template);
}

/** Structural updates increment `version` — Step 21's "Version Templates" — no snapshot history is kept, a disclosed scope decision (see `docs/plan-templates.md`). */
async function updateTemplate(id: string, workspaceId: string, input: UpdatePlanTemplateInput): Promise<DataResult<PlanTemplate>> {
  const existing = templates.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This plan template could not be found.");
  if (input.name !== undefined && !input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Template name is required." });

  const updated: PlanTemplate = { ...existing, ...input, name: input.name?.trim() ?? existing.name, version: existing.version + 1, updated_at: nowIso() };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

async function setTemplateStatus(id: string, workspaceId: string, status: TemplateStatus): Promise<DataResult<PlanTemplate>> {
  const existing = templates.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This plan template could not be found.");

  const timestamp = nowIso();
  const updated: PlanTemplate = { ...existing, status, archived_at: status === "archived" ? timestamp : null, updated_at: timestamp };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

async function duplicateTemplate(id: string, workspaceId: string, createdBy: string): Promise<DataResult<PlanTemplate>> {
  const existing = templates.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This plan template could not be found.");

  const timestamp = nowIso();
  const duplicate: PlanTemplate = {
    ...existing,
    id: generateId("plan_template"),
    name: `${existing.name} (Copy)`,
    version: 1,
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  templates = [...templates, duplicate];
  return ok(duplicate);
}

export interface PlanTemplatesRepository {
  listTemplatesForWorkspace: typeof listTemplatesForWorkspace;
  getTemplateById: typeof getTemplateById;
  createTemplate: typeof createTemplate;
  updateTemplate: typeof updateTemplate;
  setTemplateStatus: typeof setTemplateStatus;
  duplicateTemplate: typeof duplicateTemplate;
}

export const mockPlanTemplatesRepository: PlanTemplatesRepository = {
  listTemplatesForWorkspace,
  getTemplateById,
  createTemplate,
  updateTemplate,
  setTemplateStatus,
  duplicateTemplate,
};
