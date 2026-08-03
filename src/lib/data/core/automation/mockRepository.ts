import type { AutomationRepository } from "@/lib/data/core/automation/repository";
import type { AutomationExecution, RecordAutomationExecutionInput } from "@/types/automation";
import { generateId, nowIso } from "@/lib/data/utils";
import { ok, fail, type DataResult } from "@/lib/data/result";

let executions: AutomationExecution[] = [];
/** workspaceId -> automationId -> whether approval is required. */
let approvalOverrides = new Map<string, Map<string, boolean>>();

/** Test-only: restore both stores to empty between test cases. */
export function resetAutomationStore(): void {
  executions = [];
  approvalOverrides = new Map();
}

async function recordExecution(workspaceId: string, input: RecordAutomationExecutionInput): Promise<DataResult<AutomationExecution>> {
  const execution: AutomationExecution = {
    id: generateId("automation_execution"),
    workspaceId,
    ...input,
  };
  executions = [...executions, execution];
  return ok(execution);
}

async function getRecentExecutions(workspaceId: string, limit: number): Promise<AutomationExecution[]> {
  return executions
    .filter((execution) => execution.workspaceId === workspaceId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

async function getExecutionById(id: string): Promise<AutomationExecution | null> {
  return executions.find((execution) => execution.id === id) ?? null;
}

async function getPendingApprovals(workspaceId: string): Promise<AutomationExecution[]> {
  return executions
    .filter((execution) => execution.workspaceId === workspaceId && execution.approvalStatus === "pending")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

async function approveExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const existing = executions.find((execution) => execution.id === id);
  if (!existing) return fail("Automation execution not found.");
  if (existing.approvalStatus !== "pending") return fail("Only a pending execution can be approved.");

  const updated: AutomationExecution = { ...existing, approvalStatus: "approved", approvedBy: approverId, approvedAt: nowIso() };
  executions = executions.map((execution) => (execution.id === id ? updated : execution));
  return ok(updated);
}

async function rejectExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>> {
  const existing = executions.find((execution) => execution.id === id);
  if (!existing) return fail("Automation execution not found.");
  if (existing.approvalStatus !== "pending") return fail("Only a pending execution can be rejected.");

  const updated: AutomationExecution = {
    ...existing,
    approvalStatus: "rejected",
    approvedBy: approverId,
    approvedAt: nowIso(),
    status: "rejected",
    completedAt: nowIso(),
  };
  executions = executions.map((execution) => (execution.id === id ? updated : execution));
  return ok(updated);
}

async function getApprovalOverride(workspaceId: string, automationId: string): Promise<boolean | null> {
  return approvalOverrides.get(workspaceId)?.get(automationId) ?? null;
}

async function setApprovalOverride(workspaceId: string, automationId: string, required: boolean): Promise<DataResult<void>> {
  const workspaceOverrides = approvalOverrides.get(workspaceId) ?? new Map<string, boolean>();
  workspaceOverrides.set(automationId, required);
  approvalOverrides.set(workspaceId, workspaceOverrides);
  return ok(undefined);
}

export const mockAutomationRepository: AutomationRepository = {
  recordExecution,
  getRecentExecutions,
  getExecutionById,
  getPendingApprovals,
  approveExecution,
  rejectExecution,
  getApprovalOverride,
  setApprovalOverride,
};
