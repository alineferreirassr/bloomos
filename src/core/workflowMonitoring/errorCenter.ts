import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import type { AutomationDefinition, AutomationExecution } from "@/types/automation";
import type { WorkflowErrorRecord } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Error Center. One `WorkflowErrorRecord`
 * per failed action inside a `failure`/`partial_failure` execution — reads
 * straight from Automation History via `buildWorkflowExecutionSummaries`,
 * never a second failure-logging store. `retry`/`ignore`/`archive` are
 * module-action-level concerns (`modules/workflowMonitoring/`), not this
 * pure engine's — retry composes the real `executeAutomation()` entry
 * point with the failed execution's own recorded `triggerFacts`; ignore/
 * archive are workspace-scoped acknowledgement flags, never a mutation of
 * the immutable execution record itself.
 */
export function collectWorkflowErrors(executions: AutomationExecution[], automations: AutomationDefinition[]): WorkflowErrorRecord[] {
  const summaries = buildWorkflowExecutionSummaries(executions, automations);
  const errors: WorkflowErrorRecord[] = [];

  for (const summary of summaries) {
    if (summary.status !== "failure" && summary.status !== "partial_failure") continue;
    for (const actionResult of summary.actionResults) {
      if (actionResult.status !== "failure") continue;
      errors.push({
        executionId: summary.executionId,
        workflowId: summary.workflowId,
        workflowName: summary.workflowName,
        actionId: actionResult.actionId,
        stack: actionResult.message,
        entity: actionResult.resultRef ? { type: actionResult.resultRef.type, id: actionResult.resultRef.id } : summary.entity,
        retryCount: Math.max(0, actionResult.attempts - 1),
        occurredAt: summary.startedAt,
      });
    }
  }

  return errors.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
