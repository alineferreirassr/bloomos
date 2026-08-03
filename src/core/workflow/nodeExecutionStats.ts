import type { AutomationDefinition, AutomationExecution } from "@/types/automation";
import type { WorkflowNodeExecutionStats } from "@/types/workflow";

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — pure aggregation, no I/O
 * of its own (the caller already fetched `automations`/`executions`). A
 * given Workflow can compile into more than one `AutomationDefinition`
 * (one per enumerated path — `compiler.ts`'s own `enumeratePaths`), so this
 * groups every execution of every one of this Workflow's own compiled
 * Automations by the real graph node ids each path actually passed through
 * (`metadata.sourceNodeIds`), then reduces each node's own list down to
 * count/last-status/last-run/average-duration. Reuses the exact same
 * Automation History records the Automation Dashboard already reads —
 * no second execution-logging store.
 */
export function computeWorkflowNodeExecutionStats(workflowId: string, automations: AutomationDefinition[], executions: AutomationExecution[]): Record<string, WorkflowNodeExecutionStats> {
  const sourceNodeIdsByAutomationId = new Map<string, string[]>();
  for (const automation of automations) {
    const metadata = automation.metadata;
    if (!metadata || metadata.workflowId !== workflowId) continue;
    const sourceNodeIds = metadata.sourceNodeIds;
    if (!Array.isArray(sourceNodeIds)) continue;
    sourceNodeIdsByAutomationId.set(automation.id, sourceNodeIds.filter((id): id is string => typeof id === "string"));
  }
  if (sourceNodeIdsByAutomationId.size === 0) return {};

  const executionsByNodeId = new Map<string, AutomationExecution[]>();
  for (const execution of executions) {
    const nodeIds = sourceNodeIdsByAutomationId.get(execution.automationId);
    if (!nodeIds) continue;
    for (const nodeId of nodeIds) {
      const list = executionsByNodeId.get(nodeId) ?? [];
      list.push(execution);
      executionsByNodeId.set(nodeId, list);
    }
  }

  const stats: Record<string, WorkflowNodeExecutionStats> = {};
  for (const [nodeId, nodeExecutions] of executionsByNodeId) {
    const sorted = [...nodeExecutions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const totalDurationMs = sorted.reduce((sum, execution) => sum + execution.durationMs, 0);
    stats[nodeId] = {
      executionCount: sorted.length,
      lastStatus: sorted[0].status,
      lastExecutedAt: sorted[0].startedAt,
      averageDurationMs: Math.round(totalDurationMs / sorted.length),
    };
  }
  return stats;
}
