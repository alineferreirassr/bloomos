import { mockAutomationRepository } from "@/lib/data/core/automation/mockRepository";
import type { AutomationRepository } from "@/lib/data/core/automation/repository";
import { getLogger } from "@/core/observability/logger";
import type { AutomationExecution, RecordAutomationExecutionInput } from "@/types/automation";
import type { DataResult } from "@/lib/data/result";

/**
 * The one place every caller reads or writes Automation history —
 * sitting directly on the Knowledge Store (`lib/data/core/automation/`),
 * the same "Manager sits on a Store" shape `core/ai/memory/manager.ts`
 * already established. Logs safe, structural fields only — `workspaceId`/
 * `automationId`/`status`/`durationMs`/`approvalStatus` — **never** a
 * trigger's own `facts` content, matching every prior checkpoint's own
 * "safe fields only" observability rule.
 */
export function getAutomationManager(): AutomationManager {
  return automationManager;
}

export interface AutomationManager {
  recordExecution(workspaceId: string, input: RecordAutomationExecutionInput): Promise<DataResult<AutomationExecution>>;
  getRecentExecutions(workspaceId: string, limit: number): Promise<AutomationExecution[]>;
  getExecutionById(id: string): Promise<AutomationExecution | null>;
  getPendingApprovals(workspaceId: string): Promise<AutomationExecution[]>;
  approveExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>>;
  rejectExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>>;
  getApprovalOverride(workspaceId: string, automationId: string): Promise<boolean | null>;
  setApprovalOverride(workspaceId: string, automationId: string, required: boolean): Promise<DataResult<void>>;
}

function knowledgeStore(): AutomationRepository {
  return mockAutomationRepository;
}

async function recordExecution(workspaceId: string, input: RecordAutomationExecutionInput): Promise<DataResult<AutomationExecution>> {
  const result = await knowledgeStore().recordExecution(workspaceId, input);
  if (result.success) {
    getLogger().info("Automation execution recorded", {
      workspaceId,
      automationId: result.data.automationId,
      status: result.data.status,
      approvalStatus: result.data.approvalStatus,
      durationMs: result.data.durationMs,
      actionCount: result.data.actionResults.length,
    });
  }
  return result;
}

async function getRecentExecutions(workspaceId: string, limit: number): Promise<AutomationExecution[]> {
  return knowledgeStore().getRecentExecutions(workspaceId, limit);
}

async function getExecutionById(id: string): Promise<AutomationExecution | null> {
  return knowledgeStore().getExecutionById(id);
}

async function getPendingApprovals(workspaceId: string): Promise<AutomationExecution[]> {
  return knowledgeStore().getPendingApprovals(workspaceId);
}

async function approveExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const result = await knowledgeStore().approveExecution(id, approverId);
  if (result.success) getLogger().info("Automation execution approved", { executionId: id, automationId: result.data.automationId });
  return result;
}

async function rejectExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const result = await knowledgeStore().rejectExecution(id, approverId);
  if (result.success) getLogger().info("Automation execution rejected", { executionId: id, automationId: result.data.automationId });
  return result;
}

async function getApprovalOverride(workspaceId: string, automationId: string): Promise<boolean | null> {
  return knowledgeStore().getApprovalOverride(workspaceId, automationId);
}

async function setApprovalOverride(workspaceId: string, automationId: string, required: boolean): Promise<DataResult<void>> {
  const result = await knowledgeStore().setApprovalOverride(workspaceId, automationId, required);
  if (result.success) getLogger().info("Automation approval override set", { workspaceId, automationId, required });
  return result;
}

const automationManager: AutomationManager = {
  recordExecution,
  getRecentExecutions,
  getExecutionById,
  getPendingApprovals,
  approveExecution,
  rejectExecution,
  getApprovalOverride,
  setApprovalOverride,
};
