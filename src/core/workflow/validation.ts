import { analyzeWorkflowGraph } from "@/core/workflow/graphAnalysis";
import { getWorkflowNode } from "@/core/workflow/nodeRegistry";
import type { WorkflowGraph, WorkflowIssue, WorkflowValidationResult } from "@/types/workflow";

/**
 * The Step 5 Validation Engine — runs only before publishing (`manager.ts`'s
 * own `publishWorkflow`), never at runtime; once a Workflow is published,
 * the Automation Engine's own `executeAutomation()` is the only thing that
 * evaluates anything, and it never re-validates a graph. Always starts from
 * the same shared `analyzeWorkflowGraph` pass the Compiler itself uses
 * (Step 4), so a structural problem — cycle, missing node, invalid edge,
 * duplicate id, unreachable node, unsupported transition — is never
 * validated differently in two places. The five checks below are this
 * Step's own additions, on top of that shared structural pass.
 */
export function validateWorkflow(graph: WorkflowGraph): WorkflowValidationResult {
  const analysis = analyzeWorkflowGraph(graph);
  const issues: WorkflowIssue[] = [...analysis.issues];

  const hasReachableTrigger = graph.nodes.some((node) => node.kind === "trigger" && analysis.reachableNodeIds.has(node.id));
  if (!hasReachableTrigger) {
    issues.push({ code: "missing_trigger", message: "The Workflow has no reachable Trigger node.", nodeId: null, edgeId: null });
  }

  const hasReachableAction = graph.nodes.some((node) => node.kind === "action" && analysis.reachableNodeIds.has(node.id));
  if (!hasReachableAction) {
    issues.push({ code: "missing_action", message: "The Workflow has no reachable Action node.", nodeId: null, edgeId: null });
  }

  // A node with neither an incoming nor an outgoing edge at all — distinct
  // from `unreachable_node` (Step 4's own check for a node that HAS an edge
  // but no path from Start reaches it). Start itself is exempt: a brand-new
  // Workflow's own Start node is expected to have no edges yet.
  const connectedNodeIds = new Set<string>();
  for (const edge of graph.edges) {
    connectedNodeIds.add(edge.sourceNodeId);
    connectedNodeIds.add(edge.targetNodeId);
  }
  for (const node of graph.nodes) {
    if (node.kind !== "start" && !connectedNodeIds.has(node.id)) {
      issues.push({ code: "orphan_node", message: `Node "${node.label}" isn't connected to the graph at all.`, nodeId: node.id, edgeId: null });
    }
  }

  const seenVariableKeys = new Set<string>();
  for (const variable of graph.variables) {
    if (seenVariableKeys.has(variable.key)) {
      issues.push({ code: "duplicate_variable", message: `Duplicate Workflow Variable key "${variable.key}".`, nodeId: null, edgeId: null });
    }
    seenVariableKeys.add(variable.key);
  }

  // A more specific label for the subset of `cycle_detected` nodes that are
  // themselves an Approval node — the generic structural issue is still
  // present too (from `analysis.issues` above), this adds the
  // business-readable "an approval is waiting on itself" framing on top.
  const cyclicNodeIds = new Set(analysis.issues.filter((issue) => issue.code === "cycle_detected" && issue.nodeId).map((issue) => issue.nodeId as string));
  for (const node of graph.nodes) {
    if (node.kind === "approval" && cyclicNodeIds.has(node.id)) {
      issues.push({ code: "approval_loop", message: `Approval node "${node.label}" is part of an approval loop.`, nodeId: node.id, edgeId: null });
    }
  }

  // Per-node configuration validation (Step 3's own "validation" support on
  // `WorkflowNodeDefinition`) — e.g. a Condition node missing its own
  // operator/value, an Approval node missing a valid minimum role.
  for (const node of graph.nodes) {
    const definition = getWorkflowNode(node.nodeTypeId);
    const problem = definition?.validate?.({ node, graph });
    if (problem) {
      issues.push({ code: "invalid_node_configuration", message: problem, nodeId: node.id, edgeId: null });
    }
  }

  return { valid: issues.length === 0, issues };
}
