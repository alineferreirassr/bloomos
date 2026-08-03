import { analyzeWorkflowGraph } from "@/core/workflow/graphAnalysis";
import { conditionFromNode, enumeratePaths } from "@/core/workflow/compiler";
import { getWorkflowNode } from "@/core/workflow/nodeRegistry";
import { getMemoryManager } from "@/core/ai/memory";
import { getLogger } from "@/core/observability/logger";
import { CREATE_MEMORY_ACTION_ID } from "@/modules/automation/actions/createMemoryAction";
import type { WorkflowGraph, WorkflowNode, WorkflowSimulationPath, WorkflowSimulationResult, WorkflowSimulationStep } from "@/types/workflow";

const OPERATOR_LABEL: Record<string, string> = {
  eq: "equals",
  neq: "does not equal",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  in: "is one of",
  notIn: "is not one of",
};

function conditionPreview(node: WorkflowNode, branch: "true" | "false"): string {
  const condition = conditionFromNode(node, branch);
  if (!condition) return `Branches on ${branch === "true" ? "the true" : "the false"} path — not enough configuration to preview yet.`;
  const operatorLabel = OPERATOR_LABEL[condition.operator] ?? condition.operator;
  const value = Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value);
  return `${condition.field} ${operatorLabel} ${value}`;
}

/**
 * A `condition` step's own comparison (field/operator/value) is the same
 * regardless of which way a given path went, so it's always shown
 * canonically via the `"true"` operator; which branch *this* path actually
 * took is shown separately, as a badge on the downstream step it led to
 * (`WorkflowSimulationStep.branch`, computed from the *incoming* edge in
 * `simulateWorkflow` below).
 */
function stepPreview(node: WorkflowNode): string {
  const definition = getWorkflowNode(node.nodeTypeId);
  if (!definition) return `"${node.label}" isn't a registered node type.`;

  switch (node.kind) {
    case "start":
      return "Workflow starts.";
    case "trigger":
      return definition.compileTarget ? `Fires on: ${definition.name}.` : `${definition.name} — simulation-only, no real dispatch yet.`;
    case "condition":
      return conditionPreview(node, "true");
    case "approval":
      return definition.compileTarget === "never_required" ? "No approval required." : `Requires approval: ${definition.name}.`;
    case "action":
      return definition.compileTarget ? `Runs Action: ${definition.name}.` : `${definition.name} — manual step, never auto-run.`;
    case "end":
      return "Workflow ends.";
    default:
      return definition.description;
  }
}

function touchesMemory(pathNodeIds: string[], nodesById: Map<string, WorkflowNode>): boolean {
  return pathNodeIds.some((nodeId) => {
    const node = nodesById.get(nodeId);
    if (!node) return false;
    const definition = getWorkflowNode(node.nodeTypeId);
    return definition?.compileTarget === CREATE_MEMORY_ACTION_ID || definition?.compileTarget === "memory.created";
  });
}

function edgeBranchLookup(graph: WorkflowGraph): Map<string, "true" | "false" | null> {
  const lookup = new Map<string, "true" | "false" | null>();
  for (const edge of graph.edges) {
    lookup.set(`${edge.sourceNodeId}->${edge.targetNodeId}`, edge.branch);
  }
  return lookup;
}

export interface SimulateWorkflowParams {
  graph: WorkflowGraph;
  workspaceId: string;
}

/**
 * Step 6 — the Execution Simulator. Reuses the Compiler's own
 * `analyzeWorkflowGraph` + `enumeratePaths` + `conditionFromNode` rather
 * than re-implementing graph traversal a second time (this checkpoint's
 * own "never duplicate compiler logic" principle, generalized from Step 8's
 * Document integration wording to the Compiler itself) — a Simulation can
 * never show a path or a condition the real Compiler wouldn't also
 * produce. The one thing it adds beyond the Compiler: a plain-language
 * `preview` per step, and a coarse, workspace-level, read-only Memory
 * summary via the real `summarizeMemories()` (Step 11's own "read memory,"
 * never bypassing Memory's own policies) — surfaced only when at least one
 * simulated path actually touches a Memory-related node. Nothing here
 * calls a real Action, Skill, or Automation; no side effects at all.
 */
export async function simulateWorkflow(params: SimulateWorkflowParams): Promise<WorkflowSimulationResult> {
  const started = Date.now();
  const analysis = analyzeWorkflowGraph(params.graph);
  if (analysis.issues.length > 0) {
    getLogger().info("Workflow simulation blocked by structural issues", { workspaceId: params.workspaceId, issueCount: analysis.issues.length });
    return { valid: false, issues: analysis.issues, paths: [], nodeCount: params.graph.nodes.length, triggerCount: 0, memoryPreview: null };
  }

  const nodesById = new Map(params.graph.nodes.map((node) => [node.id, node]));
  const branchLookup = edgeBranchLookup(params.graph);
  const triggerNodes = params.graph.nodes.filter((node) => node.kind === "trigger" && analysis.reachableNodeIds.has(node.id));

  const paths: WorkflowSimulationPath[] = [];
  let anyPathTouchesMemory = false;

  for (const triggerNode of triggerNodes) {
    const compiledPaths = enumeratePaths(triggerNode, analysis.adjacency, nodesById);
    for (const compiledPath of compiledPaths) {
      if (touchesMemory(compiledPath.pathNodeIds, nodesById)) anyPathTouchesMemory = true;

      const steps: WorkflowSimulationStep[] = compiledPath.pathNodeIds.map((nodeId, index) => {
        const node = nodesById.get(nodeId) as WorkflowNode;
        const previousNodeId = index > 0 ? compiledPath.pathNodeIds[index - 1] : null;
        const branch = previousNodeId ? (branchLookup.get(`${previousNodeId}->${nodeId}`) ?? null) : null;
        const definition = getWorkflowNode(node.nodeTypeId);
        return { nodeId, kind: node.kind, name: definition?.name ?? node.label, preview: stepPreview(node), branch };
      });

      paths.push({ triggerNodeId: triggerNode.id, triggerName: getWorkflowNode(triggerNode.nodeTypeId)?.name ?? triggerNode.label, steps, actionCount: compiledPath.actionIds.length });
    }
  }

  let memoryPreview: WorkflowSimulationResult["memoryPreview"] = null;
  if (anyPathTouchesMemory) {
    const summary = await getMemoryManager().summarizeMemories(params.workspaceId);
    memoryPreview = { approvedCount: summary.approvedCount, pendingCount: summary.pendingCount };
  }

  getLogger().info("Workflow simulation ran", {
    workspaceId: params.workspaceId,
    nodeCount: params.graph.nodes.length,
    triggerCount: triggerNodes.length,
    pathCount: paths.length,
    durationMs: Date.now() - started,
  });

  return { valid: true, issues: [], paths, nodeCount: params.graph.nodes.length, triggerCount: triggerNodes.length, memoryPreview };
}
