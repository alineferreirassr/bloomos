import { validateWorkflow } from "@/core/workflow/validation";
import { analyzeWorkflowGraph } from "@/core/workflow/graphAnalysis";
import type { Workflow, WorkflowGraph, WorkflowNode } from "@/types/workflow";
import type { WorkflowHealthFinding, WorkflowHealthReport, WorkspaceWorkflowHealthSummary } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 addendum — merges the original Checkpoint 39 Task #732
 * "Workflow Health engine." Reuses `validateWorkflow()`
 * (`core/workflow/validation.ts`) for everything it already detects —
 * unreachable nodes, invalid/missing triggers, missing actions, cycles,
 * orphan nodes — and only adds the checks the addendum names that the
 * Validation Engine genuinely has no equivalent for:
 *
 * - "infinite loops" → `cycle_detected`, already a `WorkflowIssue` code.
 * - "unreachable nodes" → `unreachable_node`, already a `WorkflowIssue` code.
 * - "invalid triggers" → `missing_trigger`, already a `WorkflowIssue` code.
 * - "missing actions" → `missing_action`, already a `WorkflowIssue` code.
 * - "dead branches" → new: a Condition node's own branch edge that never
 *   reaches an End node, computed with the same `adjacency` map
 *   `analyzeWorkflowGraph()` already builds (never a second edge-validity
 *   pass).
 * - "duplicated actions"/"duplicated conditions" → new: two node instances
 *   in the same graph sharing a `nodeTypeId` and deep-equal `data`.
 * - "unused workflows" → new: a published Workflow whose compiled
 *   Automations have zero executions ever (the caller supplies this —
 *   see `usedWorkflowIds` below — since it requires Automation History,
 *   which this pure graph engine never fetches itself).
 * - "disabled workflows" → new: a Workflow whose own
 *   `executionPolicy.featureFlag` currently evaluates false (the caller
 *   supplies this too, via `evaluateFeatureFlag()`, an I/O boundary this
 *   pure engine never crosses itself).
 * - "archived workflows" → new: `workflow.status === "archived"`.
 */

const FINDING_PENALTY: Record<string, number> = {
  structural: 15,
  dead_branch: 10,
  duplicated_action: 5,
  duplicated_condition: 5,
  unused_workflow: 5,
  disabled_workflow: 5,
  archived_workflow: 2,
};

function findDeadBranches(graph: WorkflowGraph): WorkflowHealthFinding[] {
  const { adjacency } = analyzeWorkflowGraph(graph);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const findings: WorkflowHealthFinding[] = [];

  function canReachEnd(startId: string): boolean {
    const visited = new Set<string>([startId]);
    const stack = [startId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const node = nodesById.get(currentId);
      if (node?.kind === "end") return true;
      for (const entry of adjacency.get(currentId) ?? []) {
        if (visited.has(entry.targetId)) continue;
        visited.add(entry.targetId);
        stack.push(entry.targetId);
      }
    }
    return false;
  }

  for (const node of graph.nodes) {
    if (node.kind !== "condition") continue;
    const branches = adjacency.get(node.id) ?? [];
    for (const branchName of ["true", "false"] as const) {
      const branchEdges = branches.filter((entry) => entry.edge.branch === branchName);
      if (branchEdges.length === 0) continue;
      if (branchEdges.every((entry) => !canReachEnd(entry.targetId))) {
        findings.push({ code: "dead_branch", message: `The "${branchName}" branch of condition node "${node.label}" never reaches an End node.`, nodeId: node.id });
      }
    }
  }
  return findings;
}

function findDuplicatedNodes(graph: WorkflowGraph): WorkflowHealthFinding[] {
  const findings: WorkflowHealthFinding[] = [];
  const seen: { node: WorkflowNode; signature: string }[] = [];

  for (const node of graph.nodes) {
    if (node.kind !== "action" && node.kind !== "condition") continue;
    const signature = `${node.nodeTypeId}:${JSON.stringify(node.data, Object.keys(node.data).sort())}`;
    const duplicate = seen.find((entry) => entry.signature === signature);
    if (duplicate) {
      findings.push({
        code: node.kind === "action" ? "duplicated_action" : "duplicated_condition",
        message: `Node "${node.label}" duplicates node "${duplicate.node.label}" — same type and configuration.`,
        nodeId: node.id,
      });
    }
    seen.push({ node, signature });
  }
  return findings;
}

export interface WorkflowHealthInputs {
  /** Workflow ids with at least one Automation History execution ever recorded — computed by the caller from `getAutomationManager().getRecentExecutions()`. */
  usedWorkflowIds: Set<string>;
  /** Workflow ids whose `executionPolicy.featureFlag` currently evaluates `false` — computed by the caller via `evaluateFeatureFlag()`. */
  disabledWorkflowIds: Set<string>;
}

export function computeWorkflowHealthReport(workflow: Workflow, inputs: WorkflowHealthInputs, evaluatedAt: string): WorkflowHealthReport {
  const structuralIssues = validateWorkflow(workflow.graph).issues;
  const findings: WorkflowHealthFinding[] = [...findDeadBranches(workflow.graph), ...findDuplicatedNodes(workflow.graph)];

  if (workflow.status === "published" && !inputs.usedWorkflowIds.has(workflow.id)) {
    findings.push({ code: "unused_workflow", message: `"${workflow.metadata.name}" is published but has never executed.`, nodeId: null });
  }
  if (inputs.disabledWorkflowIds.has(workflow.id)) {
    findings.push({ code: "disabled_workflow", message: `"${workflow.metadata.name}" is gated behind a feature flag that's currently off.`, nodeId: null });
  }
  if (workflow.status === "archived") {
    findings.push({ code: "archived_workflow", message: `"${workflow.metadata.name}" is archived.`, nodeId: null });
  }

  const penalty = structuralIssues.length * FINDING_PENALTY.structural + findings.reduce((sum, finding) => sum + (FINDING_PENALTY[finding.code] ?? 5), 0);

  return {
    workflowId: workflow.id,
    workflowName: workflow.metadata.name,
    status: workflow.status,
    structuralIssues,
    findings,
    score: Math.max(0, 100 - penalty),
    evaluatedAt,
  };
}

export function computeWorkspaceWorkflowHealth(workflows: Workflow[], inputs: WorkflowHealthInputs, evaluatedAt: string): WorkspaceWorkflowHealthSummary {
  const reports = workflows.map((workflow) => computeWorkflowHealthReport(workflow, inputs, evaluatedAt));
  const totalFindings = reports.reduce((sum, report) => sum + report.structuralIssues.length + report.findings.length, 0);
  const averageScore = reports.length > 0 ? Math.round(reports.reduce((sum, report) => sum + report.score, 0) / reports.length) : null;
  return { reports, averageScore, totalFindings, evaluatedAt };
}
