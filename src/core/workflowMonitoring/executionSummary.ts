import type { AutomationActionExecutionResult, AutomationDefinition, AutomationExecution } from "@/types/automation";
import type { WorkflowExecutionBucket, WorkflowExecutionEntityRef, WorkflowExecutionSummary } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Workflow Monitoring Center. The one
 * join every other engine in this directory builds on: a real
 * `AutomationExecution` (Automation History) plus the real, already-
 * registered `AutomationDefinition` it ran through, resolved to a
 * `WorkflowExecutionSummary`. Mirrors the exact `metadata.workflowId` /
 * `metadata.sourceNodeIds` reading pattern `core/workflow/nodeExecutionStats.ts`
 * already established for per-node stats — this file is that same read,
 * generalized to a full execution row.
 */

interface CompiledWorkflowMetadata {
  workflowId: string;
  workflowVersion: string;
  sourceNodeIds: string[];
}

function readWorkflowMetadata(automation: AutomationDefinition | undefined): CompiledWorkflowMetadata | null {
  const metadata = automation?.metadata;
  if (!metadata) return null;
  const { workflowId, workflowVersion, sourceNodeIds } = metadata;
  if (typeof workflowId !== "string" || typeof workflowVersion !== "string" || !Array.isArray(sourceNodeIds)) return null;
  return { workflowId, workflowVersion, sourceNodeIds: sourceNodeIds.filter((id): id is string => typeof id === "string") };
}

/**
 * See `WorkflowExecutionBucket`'s own doc comment (`types/workflowMonitoring.ts`)
 * for why `"running"` never appears here — the engine this reads from is
 * fully synchronous, so no execution can ever be observed mid-flight.
 */
export function bucketForExecutionStatus(status: AutomationExecution["status"]): WorkflowExecutionBucket {
  switch (status) {
    case "success":
      return "successful";
    case "failure":
    case "partial_failure":
      return "failed";
    case "pending_approval":
      return "waiting";
    case "rejected":
      return "cancelled";
    case "skipped_conditions_not_met":
      return "skipped";
  }
}

function entityFromActionResults(actionResults: AutomationActionExecutionResult[]): WorkflowExecutionEntityRef | null {
  const withRef = actionResults.find((result) => result.resultRef);
  return withRef?.resultRef ? { type: withRef.resultRef.type, id: withRef.resultRef.id } : null;
}

export function buildWorkflowExecutionSummary(execution: AutomationExecution, automationsById: Map<string, AutomationDefinition>): WorkflowExecutionSummary {
  const automation = automationsById.get(execution.automationId);
  const workflowMetadata = readWorkflowMetadata(automation);
  const executionPath = workflowMetadata?.sourceNodeIds ?? [];
  // The last node in the compiled path this execution's automation belongs to — only meaningful once at least one
  // action actually ran; the synchronous engine model has no way to attribute a "current node" any more precisely
  // than that (see `WorkflowExecutionSummary.currentNodeId`'s own doc comment for the full disclosure).
  const currentNodeId = executionPath.length > 0 && execution.actionResults.length > 0 ? (executionPath[executionPath.length - 1] ?? null) : null;

  return {
    executionId: execution.id,
    workflowId: workflowMetadata?.workflowId ?? null,
    workflowName: automation?.name ?? execution.automationName,
    workflowVersion: workflowMetadata?.workflowVersion ?? execution.automationVersion,
    bucket: bucketForExecutionStatus(execution.status),
    status: execution.status,
    trigger: execution.trigger,
    executionPath,
    currentNodeId,
    entity: entityFromActionResults(execution.actionResults),
    startedBy: execution.startedBy ?? null,
    startedAt: execution.startedAt,
    finishedAt: execution.completedAt,
    durationMs: execution.durationMs,
    actionResults: execution.actionResults,
  };
}

export function buildWorkflowExecutionSummaries(executions: AutomationExecution[], automations: AutomationDefinition[]): WorkflowExecutionSummary[] {
  const automationsById = new Map(automations.map((automation) => [automation.id, automation]));
  return executions.map((execution) => buildWorkflowExecutionSummary(execution, automationsById));
}
