import type {
  CreateWorkflowInput,
  RecordPublishedVersionInput,
  UpdateWorkflowDraftInput,
  WorkflowRepository,
} from "@/lib/data/core/workflow/repository";
import type { Workflow, WorkflowVersion } from "@/types/workflow";
import { generateId, nowIso } from "@/lib/data/utils";
import { ok, fail, type DataResult } from "@/lib/data/result";

let workflows: Workflow[] = [];
let versions: WorkflowVersion[] = [];

/** Test-only: restore both stores to empty between test cases. */
export function resetWorkflowStore(): void {
  workflows = [];
  versions = [];
}

async function createWorkflow(workspaceId: string, createdBy: string, input: CreateWorkflowInput): Promise<DataResult<Workflow>> {
  const now = nowIso();
  const workflow: Workflow = {
    id: generateId("workflow"),
    workspaceId,
    status: "draft",
    metadata: input.metadata,
    executionPolicy: input.executionPolicy,
    graph: input.graph,
    currentVersion: 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  workflows = [...workflows, workflow];
  return ok(workflow);
}

async function getWorkflowById(id: string, workspaceId?: string): Promise<Workflow | null> {
  const workflow = workflows.find((workflow) => workflow.id === id) ?? null;
  if (!workflow) return null;
  if (workspaceId !== undefined && workflow.workspaceId !== workspaceId) return null;
  return workflow;
}

async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  return workflows.filter((workflow) => workflow.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function updateWorkflowDraft(id: string, input: UpdateWorkflowDraftInput): Promise<DataResult<Workflow>> {
  const existing = workflows.find((workflow) => workflow.id === id);
  if (!existing) return fail("Workflow not found.");
  if (existing.status === "archived") return fail("An archived Workflow's draft cannot be edited — unarchive it first.");

  const updated: Workflow = {
    ...existing,
    metadata: input.metadata ?? existing.metadata,
    executionPolicy: input.executionPolicy ?? existing.executionPolicy,
    graph: input.graph ?? existing.graph,
    updatedAt: nowIso(),
  };
  workflows = workflows.map((workflow) => (workflow.id === id ? updated : workflow));
  return ok(updated);
}

async function archiveWorkflow(id: string): Promise<DataResult<Workflow>> {
  const existing = workflows.find((workflow) => workflow.id === id);
  if (!existing) return fail("Workflow not found.");
  const updated: Workflow = { ...existing, status: "archived", archivedAt: nowIso(), updatedAt: nowIso() };
  workflows = workflows.map((workflow) => (workflow.id === id ? updated : workflow));
  return ok(updated);
}

async function unarchiveWorkflow(id: string): Promise<DataResult<Workflow>> {
  const existing = workflows.find((workflow) => workflow.id === id);
  if (!existing) return fail("Workflow not found.");
  if (existing.status !== "archived") return fail("Only an archived Workflow can be unarchived.");
  const updated: Workflow = { ...existing, status: existing.currentVersion > 0 ? "published" : "draft", archivedAt: null, updatedAt: nowIso() };
  workflows = workflows.map((workflow) => (workflow.id === id ? updated : workflow));
  return ok(updated);
}

async function cloneWorkflow(id: string, createdBy: string): Promise<DataResult<Workflow>> {
  const source = workflows.find((workflow) => workflow.id === id);
  if (!source) return fail("Workflow not found.");
  const now = nowIso();
  const cloned: Workflow = {
    id: generateId("workflow"),
    workspaceId: source.workspaceId,
    status: "draft",
    metadata: { ...source.metadata, name: `${source.metadata.name} (Copy)` },
    executionPolicy: source.executionPolicy,
    graph: source.graph,
    currentVersion: 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
  workflows = [...workflows, cloned];
  return ok(cloned);
}

async function recordPublishedVersion(workflowId: string, input: RecordPublishedVersionInput): Promise<DataResult<WorkflowVersion>> {
  const existing = workflows.find((workflow) => workflow.id === workflowId);
  if (!existing) return fail("Workflow not found.");

  const nextVersionNumber = existing.currentVersion + 1;
  const version: WorkflowVersion = {
    id: generateId("workflow_version"),
    workflowId,
    workspaceId: existing.workspaceId,
    version: nextVersionNumber,
    graph: input.graph,
    metadata: input.metadata,
    executionPolicy: input.executionPolicy,
    compiledAutomationIds: input.compiledAutomationIds,
    publishedBy: input.publishedBy,
    publishedAt: nowIso(),
  };
  versions = [...versions, version];

  const updatedWorkflow: Workflow = { ...existing, status: "published", currentVersion: nextVersionNumber, updatedAt: nowIso() };
  workflows = workflows.map((workflow) => (workflow.id === workflowId ? updatedWorkflow : workflow));

  return ok(version);
}

async function getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
  return versions.filter((version) => version.workflowId === workflowId).sort((a, b) => b.version - a.version);
}

async function getWorkflowVersion(workflowId: string, version: number): Promise<WorkflowVersion | null> {
  return versions.find((entry) => entry.workflowId === workflowId && entry.version === version) ?? null;
}

async function restoreWorkflowVersion(workflowId: string, version: number): Promise<DataResult<Workflow>> {
  const existing = workflows.find((workflow) => workflow.id === workflowId);
  if (!existing) return fail("Workflow not found.");
  const target = versions.find((entry) => entry.workflowId === workflowId && entry.version === version);
  if (!target) return fail("That Workflow version doesn't exist.");

  const updated: Workflow = {
    ...existing,
    graph: target.graph,
    metadata: target.metadata,
    executionPolicy: target.executionPolicy,
    updatedAt: nowIso(),
  };
  workflows = workflows.map((workflow) => (workflow.id === workflowId ? updated : workflow));
  return ok(updated);
}

export const mockWorkflowRepository: WorkflowRepository = {
  createWorkflow,
  getWorkflowById,
  listWorkflows,
  updateWorkflowDraft,
  archiveWorkflow,
  unarchiveWorkflow,
  cloneWorkflow,
  recordPublishedVersion,
  getWorkflowVersions,
  getWorkflowVersion,
  restoreWorkflowVersion,
};
