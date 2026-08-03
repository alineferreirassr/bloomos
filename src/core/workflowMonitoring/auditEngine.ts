import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import type { AutomationDefinition, AutomationExecution } from "@/types/automation";
import type { WorkflowAuditRecord } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Workflow Audit. Pure read-model over
 * `AutomationExecution` — already immutable and append-only (see that
 * type's own doc comment in `types/automation.ts`), which already
 * satisfies "every workflow execution should produce an immutable audit
 * record." No second write path, no second store.
 */
export function buildWorkflowAuditRecords(executions: AutomationExecution[], automations: AutomationDefinition[]): WorkflowAuditRecord[] {
  const triggerFactsByExecutionId = new Map(executions.map((execution) => [execution.id, execution.triggerFacts]));
  return buildWorkflowExecutionSummaries(executions, automations).map((summary) => ({
    executionId: summary.executionId,
    workflowId: summary.workflowId,
    workflowName: summary.workflowName,
    versionExecuted: summary.workflowVersion,
    inputs: triggerFactsByExecutionId.get(summary.executionId) ?? {},
    outputs: summary.actionResults,
    durationMs: summary.durationMs,
    nodePath: summary.executionPath,
    actor: summary.startedBy ?? "system",
    timestamp: summary.startedAt,
  }));
}
