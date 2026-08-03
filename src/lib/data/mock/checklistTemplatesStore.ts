import type { ChecklistTemplate, ChecklistKind, TemplateStatus } from "@/types/operationalPlanning";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27.2, Step 9 — Checklist Template Registry persistence. Structural only (item labels), no per-instance completion state — `PlanChecklist` snapshots one of these onto a plan at attach time. Same convention as `resourceBundlesStore.ts`. */
let templates: ChecklistTemplate[] = [];

export function resetChecklistTemplatesStore(): void {
  templates = [];
}

export interface CreateChecklistTemplateInput {
  name: string;
  kind: ChecklistKind;
  items: Array<{ label: string }>;
}

async function listTemplatesForWorkspace(workspaceId: string, includeArchived = false): Promise<ChecklistTemplate[]> {
  return templates.filter((t) => t.workspace_id === workspaceId && (includeArchived || t.status === "active"));
}

async function getTemplateById(id: string): Promise<ChecklistTemplate | null> {
  return templates.find((t) => t.id === id) ?? null;
}

async function createTemplate(workspaceId: string, createdBy: string, input: CreateChecklistTemplateInput): Promise<DataResult<ChecklistTemplate>> {
  if (!input.name.trim()) return fail("Please fix the highlighted fields.", { name: "Checklist name is required." });
  if (input.items.length === 0) return fail("Please fix the highlighted fields.", { items: "At least one checklist item is needed." });

  const timestamp = nowIso();
  const template: ChecklistTemplate = {
    id: generateId("checklist_template"),
    workspace_id: workspaceId,
    name: input.name.trim(),
    kind: input.kind,
    items: input.items.map((item) => ({ id: generateId("checklist_template_item"), label: item.label })),
    status: "active",
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  templates = [...templates, template];
  return ok(template);
}

async function setTemplateStatus(id: string, workspaceId: string, status: TemplateStatus): Promise<DataResult<ChecklistTemplate>> {
  const existing = templates.find((t) => t.id === id && t.workspace_id === workspaceId);
  if (!existing) return fail("This checklist template could not be found.");

  const timestamp = nowIso();
  const updated: ChecklistTemplate = { ...existing, status, archived_at: status === "archived" ? timestamp : null, updated_at: timestamp };
  templates = templates.map((t) => (t.id === id ? updated : t));
  return ok(updated);
}

export interface ChecklistTemplatesRepository {
  listTemplatesForWorkspace: typeof listTemplatesForWorkspace;
  getTemplateById: typeof getTemplateById;
  createTemplate: typeof createTemplate;
  setTemplateStatus: typeof setTemplateStatus;
}

export const mockChecklistTemplatesRepository: ChecklistTemplatesRepository = {
  listTemplatesForWorkspace,
  getTemplateById,
  createTemplate,
  setTemplateStatus,
};
