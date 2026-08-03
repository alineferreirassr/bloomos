import { buildWorkflowExecutionSummaries } from "@/core/workflowMonitoring/executionSummary";
import type { AutomationDefinition, AutomationExecution } from "@/types/automation";
import type { Workflow } from "@/types/workflow";
import type { WorkflowExecutionBucket, WorkflowExecutionSummary, WorkflowScheduledSummary } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Live Execution Monitor. Groups the
 * same `WorkflowExecutionSummary[]` `executionSummary.ts` already builds
 * into the six named buckets, and separately lists every Workflow with a
 * configured schedule (never a live queue — see `WorkflowScheduledSummary`'s
 * own doc comment). No new execution or scheduling logic of any kind.
 */
export interface WorkflowLiveMonitorSnapshot {
  buckets: Record<WorkflowExecutionBucket, WorkflowExecutionSummary[]>;
  scheduled: WorkflowScheduledSummary[];
  evaluatedAt: string;
}

export function computeWorkflowLiveMonitor(executions: AutomationExecution[], automations: AutomationDefinition[], workflows: Workflow[], evaluatedAt: string): WorkflowLiveMonitorSnapshot {
  const summaries = buildWorkflowExecutionSummaries(executions, automations);

  const buckets: Record<WorkflowExecutionBucket, WorkflowExecutionSummary[]> = {
    running: [],
    waiting: [],
    failed: [],
    successful: [],
    cancelled: [],
    skipped: [],
  };
  for (const summary of summaries) buckets[summary.bucket].push(summary);

  const scheduled: WorkflowScheduledSummary[] = workflows
    .filter((workflow) => workflow.executionPolicy.scheduledExecution !== null)
    .map((workflow) => {
      const schedule = workflow.executionPolicy.scheduledExecution!;
      return {
        workflowId: workflow.id,
        workflowName: workflow.metadata.name,
        status: workflow.status,
        frequency: schedule.frequency,
        time: schedule.time,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
      };
    });

  return { buckets, scheduled, evaluatedAt };
}
