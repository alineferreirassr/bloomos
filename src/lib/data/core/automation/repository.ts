import type { AutomationExecution, RecordAutomationExecutionInput } from "@/types/automation";
import type { DataResult } from "@/lib/data/result";

/**
 * Persistence for the Automation Engine's own execution history and
 * per-Workspace approval-policy overrides — the Knowledge Store to
 * `core/automation/manager.ts`'s own Memory-Manager-shaped orchestration
 * (create/read/approve/reject, safe-fields-only logging at the manager
 * layer, never here). No hard delete — `approveExecution`/`rejectExecution`
 * move a `"pending"` execution to a terminal `approvalStatus`, matching the
 * Audit Log's own immutable-record precedent every other new domain in
 * this app already follows.
 */
export interface AutomationRepository {
  recordExecution(workspaceId: string, input: RecordAutomationExecutionInput): Promise<DataResult<AutomationExecution>>;
  getRecentExecutions(workspaceId: string, limit: number): Promise<AutomationExecution[]>;
  getExecutionById(id: string): Promise<AutomationExecution | null>;
  /** Every execution still awaiting a human decision — the Dashboard's own "Pending Approvals" section. */
  getPendingApprovals(workspaceId: string): Promise<AutomationExecution[]>;
  approveExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>>;
  rejectExecution(id: string, approverId: string): Promise<DataResult<AutomationExecution>>;
  /** `null` = no override set for this Automation in this Workspace — the caller (Approval Engine) decides the safe default. */
  getApprovalOverride(workspaceId: string, automationId: string): Promise<boolean | null>;
  setApprovalOverride(workspaceId: string, automationId: string, required: boolean): Promise<DataResult<void>>;
}
