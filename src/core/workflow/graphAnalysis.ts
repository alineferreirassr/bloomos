import type { WorkflowEdge, WorkflowGraph, WorkflowIssue, WorkflowNode, WorkflowNodeKind } from "@/types/workflow";

/**
 * The one, shared source of truth for "is this graph structurally sound" —
 * both the Compiler (Step 4, which refuses to compile a broken graph) and
 * the Validation Engine (Step 5, which surfaces the same problems as
 * publish-blocking issues) run this exact analysis, never a second,
 * divergent implementation of cycle detection or reachability.
 *
 * Which node kind may connect to which — `start` only ever leads to
 * `trigger`; `end` never has an outgoing edge. Every non-terminal kind may
 * lead to any other non-`start` kind, matching the checkpoint's own
 * "Condition → Approval → Action, in any order the author wants" flexibility
 * while still forbidding a cycle back into `start` or a dangling edge out of
 * `end`.
 */
const ALLOWED_TRANSITIONS: Record<WorkflowNodeKind, WorkflowNodeKind[]> = {
  start: ["trigger"],
  trigger: ["condition", "approval", "action", "end"],
  condition: ["condition", "approval", "action", "end"],
  approval: ["condition", "approval", "action", "end"],
  action: ["condition", "approval", "action", "end"],
  end: [],
};

export interface WorkflowAdjacencyEntry {
  targetId: string;
  edge: WorkflowEdge;
}

export interface WorkflowGraphAnalysis {
  issues: WorkflowIssue[];
  /** Only edges that passed every structural check — an unsupported-transition or missing-node edge is excluded, so downstream traversal (reachability, compilation) never walks through a known-broken edge. */
  adjacency: Map<string, WorkflowAdjacencyEntry[]>;
  /** `null` when zero or more than one Start node exists — see the `"invalid_graph"` issue raised in that case. */
  startNode: WorkflowNode | null;
  /** Every node id reachable from `startNode` by a valid edge, including `startNode.id` itself. Empty when `startNode` is `null`. */
  reachableNodeIds: Set<string>;
}

function findDuplicateIdIssues(graph: WorkflowGraph): WorkflowIssue[] {
  const issues: WorkflowIssue[] = [];
  const seenNodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenNodeIds.has(node.id)) {
      issues.push({ code: "duplicate_id", message: `Duplicate node id "${node.id}".`, nodeId: node.id, edgeId: null });
    }
    seenNodeIds.add(node.id);
  }
  const seenEdgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (seenEdgeIds.has(edge.id)) {
      issues.push({ code: "duplicate_id", message: `Duplicate edge id "${edge.id}".`, nodeId: null, edgeId: edge.id });
    }
    seenEdgeIds.add(edge.id);
  }
  return issues;
}

function buildAdjacency(graph: WorkflowGraph, nodesById: Map<string, WorkflowNode>): { adjacency: Map<string, WorkflowAdjacencyEntry[]>; issues: WorkflowIssue[] } {
  const issues: WorkflowIssue[] = [];
  const adjacency = new Map<string, WorkflowAdjacencyEntry[]>();

  for (const edge of graph.edges) {
    const source = nodesById.get(edge.sourceNodeId);
    const target = nodesById.get(edge.targetNodeId);
    if (!source || !target) {
      issues.push({ code: "missing_node", message: `Edge "${edge.id}" references a node that no longer exists.`, nodeId: null, edgeId: edge.id });
      continue;
    }
    if (edge.sourceNodeId === edge.targetNodeId) {
      issues.push({ code: "invalid_edge", message: `Edge "${edge.id}" connects a node to itself.`, nodeId: null, edgeId: edge.id });
      continue;
    }
    const expectsBranch = source.kind === "condition";
    if (expectsBranch && edge.branch === null) {
      issues.push({ code: "invalid_edge", message: `Edge "${edge.id}" leaves a Condition node without a branch selected.`, nodeId: null, edgeId: edge.id });
      continue;
    }
    if (!expectsBranch && edge.branch !== null) {
      issues.push({ code: "invalid_edge", message: `Edge "${edge.id}" sets a branch, but its source node isn't a Condition.`, nodeId: null, edgeId: edge.id });
      continue;
    }
    if (!ALLOWED_TRANSITIONS[source.kind].includes(target.kind)) {
      issues.push({ code: "unsupported_transition", message: `A ${source.kind} node cannot connect to a ${target.kind} node.`, nodeId: null, edgeId: edge.id });
      continue;
    }
    const entries = adjacency.get(edge.sourceNodeId) ?? [];
    entries.push({ targetId: edge.targetNodeId, edge });
    adjacency.set(edge.sourceNodeId, entries);
  }

  return { adjacency, issues };
}

function findStartNode(graph: WorkflowGraph): { startNode: WorkflowNode | null; issues: WorkflowIssue[] } {
  const startNodes = graph.nodes.filter((node) => node.kind === "start");
  if (startNodes.length === 0) {
    return { startNode: null, issues: [{ code: "invalid_graph", message: "The Workflow has no Start node.", nodeId: null, edgeId: null }] };
  }
  if (startNodes.length > 1) {
    return { startNode: null, issues: [{ code: "invalid_graph", message: "The Workflow has more than one Start node.", nodeId: null, edgeId: null }] };
  }
  return { startNode: startNodes[0], issues: [] };
}

function findReachableNodeIds(startNode: WorkflowNode, adjacency: Map<string, WorkflowAdjacencyEntry[]>): Set<string> {
  const reachable = new Set<string>([startNode.id]);
  const queue: string[] = [startNode.id];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    for (const { targetId } of adjacency.get(currentId) ?? []) {
      if (!reachable.has(targetId)) {
        reachable.add(targetId);
        queue.push(targetId);
      }
    }
  }
  return reachable;
}

function findUnreachableNodeIssues(graph: WorkflowGraph, startNode: WorkflowNode, reachableNodeIds: Set<string>): WorkflowIssue[] {
  return graph.nodes
    .filter((node) => node.id !== startNode.id && !reachableNodeIds.has(node.id))
    .map((node) => ({ code: "unreachable_node" as const, message: `Node "${node.label}" is unreachable from Start.`, nodeId: node.id, edgeId: null }));
}

/** Depth-first white/gray/black cycle detection — every node touched by a cycle is reported exactly once, regardless of how many times the cycle's own traversal revisits it. */
function findCycleIssues(graph: WorkflowGraph, adjacency: Map<string, WorkflowAdjacencyEntry[]>, nodesById: Map<string, WorkflowNode>): WorkflowIssue[] {
  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const state = new Map<string, number>(graph.nodes.map((node) => [node.id, UNVISITED]));
  const cyclicNodeIds = new Set<string>();

  function visit(nodeId: string): void {
    state.set(nodeId, IN_PROGRESS);
    for (const { targetId } of adjacency.get(nodeId) ?? []) {
      const targetState = state.get(targetId);
      if (targetState === IN_PROGRESS) {
        cyclicNodeIds.add(nodeId);
        cyclicNodeIds.add(targetId);
      } else if (targetState === UNVISITED) {
        visit(targetId);
      }
    }
    state.set(nodeId, DONE);
  }

  for (const node of graph.nodes) {
    if (state.get(node.id) === UNVISITED) visit(node.id);
  }

  return [...cyclicNodeIds].map((nodeId) => ({
    code: "cycle_detected" as const,
    message: `Node "${nodesById.get(nodeId)?.label ?? nodeId}" is part of a cycle.`,
    nodeId,
    edgeId: null,
  }));
}

/**
 * The full structural pass (Step 4's own six checks): duplicate ids →
 * missing node references / invalid edges / unsupported transitions → a
 * single required Start node → reachability from it → cycles. Every check
 * runs even after an earlier one fails, so a single `analyzeWorkflowGraph`
 * call surfaces every structural problem at once, not just the first —
 * matching how a real editor would want to flag every broken edge in one
 * pass, not make an author fix issues one at a time.
 */
export function analyzeWorkflowGraph(graph: WorkflowGraph): WorkflowGraphAnalysis {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const issues: WorkflowIssue[] = [...findDuplicateIdIssues(graph)];

  const { adjacency, issues: adjacencyIssues } = buildAdjacency(graph, nodesById);
  issues.push(...adjacencyIssues);

  const { startNode, issues: startIssues } = findStartNode(graph);
  issues.push(...startIssues);

  let reachableNodeIds = new Set<string>();
  if (startNode) {
    reachableNodeIds = findReachableNodeIds(startNode, adjacency);
    issues.push(...findUnreachableNodeIssues(graph, startNode, reachableNodeIds));
  }

  issues.push(...findCycleIssues(graph, adjacency, nodesById));

  return { issues, adjacency, startNode, reachableNodeIds };
}
