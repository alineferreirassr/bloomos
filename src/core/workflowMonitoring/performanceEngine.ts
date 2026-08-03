import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import type { AutomationDefinition, AutomationExecution, AutomationTriggerType } from "@/types/automation";
import type { WorkflowDurationRanking, WorkflowExecutionFrequency, WorkflowPerformanceMetrics } from "@/types/workflowMonitoring";

const RANKING_SIZE = 5;

/**
 * v2.0 Checkpoint 39 addendum — merges the original Checkpoint 39 Task #731
 * "Workflow Analytics engine." Every metric is a pure aggregation over the
 * same `WorkflowExecutionSummary[]` every other Monitoring Center engine
 * reads, mirroring the join `core/workflow/nodeExecutionStats.ts` already
 * established — this is that same join, summarized workspace-wide instead
 * of per-node.
 */
export function computeWorkflowPerformanceMetrics(executions: AutomationExecution[], automations: AutomationDefinition[], evaluatedAt: string): WorkflowPerformanceMetrics {
  const summaries = buildWorkflowExecutionSummaries(executions, automations);

  if (summaries.length === 0) {
    return {
      averageExecutionDurationMs: null,
      slowestWorkflows: [],
      fastestWorkflows: [],
      mostExecutedWorkflows: [],
      failedExecutionCount: 0,
      successRate: null,
      averageWaitTimeMs: null,
      nodeExecutionFrequency: {},
      actionExecutionFrequency: {},
      triggerFrequency: {},
      evaluatedAt,
    };
  }

  const totalDurationMs = summaries.reduce((sum, summary) => sum + summary.durationMs, 0);
  const failedExecutionCount = summaries.filter((summary) => summary.bucket === "failed").length;
  const successCount = summaries.filter((summary) => summary.status === "success").length;

  const durationsByWorkflow = new Map<string, { workflowName: string; totalDurationMs: number; count: number }>();
  const countByWorkflow = new Map<string, { workflowName: string; count: number }>();
  const nodeExecutionFrequency: Record<string, number> = {};
  const actionExecutionFrequency: Record<string, number> = {};
  const triggerFrequency: Partial<Record<AutomationTriggerType, number>> = {};

  for (const summary of summaries) {
    triggerFrequency[summary.trigger] = (triggerFrequency[summary.trigger] ?? 0) + 1;

    for (const actionResult of summary.actionResults) {
      actionExecutionFrequency[actionResult.actionId] = (actionExecutionFrequency[actionResult.actionId] ?? 0) + 1;
    }
    for (const nodeId of summary.executionPath) {
      nodeExecutionFrequency[nodeId] = (nodeExecutionFrequency[nodeId] ?? 0) + 1;
    }

    if (!summary.workflowId) continue;
    const durationEntry = durationsByWorkflow.get(summary.workflowId) ?? { workflowName: summary.workflowName, totalDurationMs: 0, count: 0 };
    durationEntry.totalDurationMs += summary.durationMs;
    durationEntry.count += 1;
    durationsByWorkflow.set(summary.workflowId, durationEntry);

    const countEntry = countByWorkflow.get(summary.workflowId) ?? { workflowName: summary.workflowName, count: 0 };
    countEntry.count += 1;
    countByWorkflow.set(summary.workflowId, countEntry);
  }

  const rankings: WorkflowDurationRanking[] = Array.from(durationsByWorkflow.entries()).map(([workflowId, entry]) => ({
    workflowId,
    workflowName: entry.workflowName,
    averageDurationMs: Math.round(entry.totalDurationMs / entry.count),
  }));
  const slowestWorkflows = [...rankings].sort((a, b) => b.averageDurationMs - a.averageDurationMs).slice(0, RANKING_SIZE);
  const fastestWorkflows = [...rankings].sort((a, b) => a.averageDurationMs - b.averageDurationMs).slice(0, RANKING_SIZE);

  const mostExecutedWorkflows: WorkflowExecutionFrequency[] = Array.from(countByWorkflow.entries())
    .map(([workflowId, entry]) => ({ workflowId, workflowName: entry.workflowName, executionCount: entry.count }))
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, RANKING_SIZE);

  const waitTimes = executions
    .filter((execution) => execution.approvedAt !== null)
    .map((execution) => new Date(execution.approvedAt!).getTime() - new Date(execution.startedAt).getTime())
    .filter((waitMs) => Number.isFinite(waitMs) && waitMs >= 0);

  return {
    averageExecutionDurationMs: Math.round(totalDurationMs / summaries.length),
    slowestWorkflows,
    fastestWorkflows,
    mostExecutedWorkflows,
    failedExecutionCount,
    successRate: Math.round((successCount / summaries.length) * 100),
    averageWaitTimeMs: waitTimes.length > 0 ? Math.round(waitTimes.reduce((sum, ms) => sum + ms, 0) / waitTimes.length) : null,
    nodeExecutionFrequency,
    actionExecutionFrequency,
    triggerFrequency,
    evaluatedAt,
  };
}
