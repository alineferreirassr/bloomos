import { mockWorkflowRepository } from "@/lib/data/core/workflow/mockRepository";
import type { CreateWorkflowInput, RecordPublishedVersionInput, UpdateWorkflowDraftInput, WorkflowRepository } from "@/lib/data/core/workflow/repository";
import { getLogger } from "@/core/observability/logger";
import type { Workflow, WorkflowVersion } from "@/types/workflow";
import type { DataResult } from "@/lib/data/result";

/**
 * The one place every caller reads or writes Workflow storage — sitting
 * directly on the Knowledge Store (`lib/data/core/workflow/`), the same
 * "Manager sits on a Store" shape `core/automation/manager.ts` already
 * established. Logs safe, structural fields only — `workflowId`/`status`/
 * `version`/`compiledAutomationIds.length` — **never** a graph's own nodes,
 * edges, or node `data` (which may carry a Condition's own comparison
 * value or similar workspace-specific detail), matching Step 16's own
 * "Never log workflow payloads."
 */
export function getWorkflowManager(): WorkflowManager {
  return workflowManager;
}

export interface WorkflowManager {
  createWorkflow(workspaceId: string, createdBy: string, input: CreateWorkflowInput): Promise<DataResult<Workflow>>;
  getWorkflowById(id: string, workspaceId?: string): Promise<Workflow | null>;
  listWorkflows(workspaceId: string): Promise<Workflow[]>;
  updateWorkflowDraft(id: string, input: UpdateWorkflowDraftInput): Promise<DataResult<Workflow>>;
  archiveWorkflow(id: string): Promise<DataResult<Workflow>>;
  unarchiveWorkflow(id: string): Promise<DataResult<Workflow>>;
  cloneWorkflow(id: string, createdBy: string): Promise<DataResult<Workflow>>;
  recordPublishedVersion(workflowId: string, input: RecordPublishedVersionInput): Promise<DataResult<WorkflowVersion>>;
  getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]>;
  getWorkflowVersion(workflowId: string, version: number): Promise<WorkflowVersion | null>;
  restoreWorkflowVersion(workflowId: string, version: number): Promise<DataResult<Workflow>>;
}

function knowledgeStore(): WorkflowRepository {
  return mockWorkflowRepository;
}

async function createWorkflow(workspaceId: string, createdBy: string, input: CreateWorkflowInput): Promise<DataResult<Workflow>> {
  const result = await knowledgeStore().createWorkflow(workspaceId, createdBy, input);
  if (result.success) getLogger().info("Workflow created", { workspaceId, workflowId: result.data.id, status: result.data.status });
  return result;
}

async function getWorkflowById(id: string, workspaceId?: string): Promise<Workflow | null> {
  return knowledgeStore().getWorkflowById(id, workspaceId);
}

async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  return knowledgeStore().listWorkflows(workspaceId);
}

async function updateWorkflowDraft(id: string, input: UpdateWorkflowDraftInput): Promise<DataResult<Workflow>> {
  return knowledgeStore().updateWorkflowDraft(id, input);
}

async function archiveWorkflow(id: string): Promise<DataResult<Workflow>> {
  const result = await knowledgeStore().archiveWorkflow(id);
  if (result.success) getLogger().info("Workflow archived", { workflowId: id });
  return result;
}

async function unarchiveWorkflow(id: string): Promise<DataResult<Workflow>> {
  const result = await knowledgeStore().unarchiveWorkflow(id);
  if (result.success) getLogger().info("Workflow unarchived", { workflowId: id, status: result.data.status });
  return result;
}

async function cloneWorkflow(id: string, createdBy: string): Promise<DataResult<Workflow>> {
  const result = await knowledgeStore().cloneWorkflow(id, createdBy);
  if (result.success) getLogger().info("Workflow cloned", { sourceWorkflowId: id, clonedWorkflowId: result.data.id });
  return result;
}

async function recordPublishedVersion(workflowId: string, input: RecordPublishedVersionInput): Promise<DataResult<WorkflowVersion>> {
  const result = await knowledgeStore().recordPublishedVersion(workflowId, input);
  if (result.success) {
    getLogger().info("Workflow published", {
      workflowId,
      version: result.data.version,
      compiledAutomationCount: result.data.compiledAutomationIds.length,
    });
  }
  return result;
}

async function getWorkflowVersions(workflowId: string): Promise<WorkflowVersion[]> {
  return knowledgeStore().getWorkflowVersions(workflowId);
}

async function getWorkflowVersion(workflowId: string, version: number): Promise<WorkflowVersion | null> {
  return knowledgeStore().getWorkflowVersion(workflowId, version);
}

async function restoreWorkflowVersion(workflowId: string, version: number): Promise<DataResult<Workflow>> {
  const result = await knowledgeStore().restoreWorkflowVersion(workflowId, version);
  if (result.success) getLogger().info("Workflow version restored", { workflowId, version });
  return result;
}

const workflowManager: WorkflowManager = {
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
