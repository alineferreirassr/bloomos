import type { Edge, Node } from "@xyflow/react";
import type { WorkflowAnnotation, WorkflowAnnotationKind, WorkflowEdge, WorkflowEdgeBranch, WorkflowGraph, WorkflowNode } from "@/types/workflow";

/**
 * The one boundary between BloomOS's own framework-agnostic graph model
 * (`types/workflow.ts`) and React Flow's own `Node`/`Edge` shape. Nothing
 * outside `modules/workflow/canvas/` ever imports `@xyflow/react` — every
 * translation happens here, so replacing the rendering library later means
 * rewriting this one file's own two functions, never the Compiler,
 * Validation Engine, Storage, or any business-logic caller.
 */

export const WORKFLOW_NODE_RENDER_TYPE = "workflowNode";
export const WORKFLOW_EDGE_RENDER_TYPE = "workflowEdge";
/** v2.0 Checkpoint 39 addendum (Workflow Studio) — the two `WorkflowAnnotation` render types, kept as their own React Flow node types so a "Comment"/"Group" never risks matching the real `NodeRenderer`'s `WORKFLOW_NODE_RENDER_TYPE` and being mistaken for a graph node anywhere. */
export const WORKFLOW_COMMENT_RENDER_TYPE = "workflowComment";
export const WORKFLOW_GROUP_RENDER_TYPE = "workflowGroup";

const ANNOTATION_RENDER_TYPE: Record<WorkflowAnnotationKind, string> = {
  comment: WORKFLOW_COMMENT_RENDER_TYPE,
  group: WORKFLOW_GROUP_RENDER_TYPE,
};

export interface WorkflowNodeRenderData extends Record<string, unknown> {
  kind: WorkflowNode["kind"];
  nodeTypeId: string;
  label: string;
  data: WorkflowNode["data"];
}

export interface WorkflowEdgeRenderData extends Record<string, unknown> {
  branch: WorkflowEdgeBranch;
}

export interface WorkflowAnnotationRenderData extends Record<string, unknown> {
  kind: WorkflowAnnotationKind;
  text: string;
  color: string;
}

/** Every React Flow node the Canvas ever renders — a real graph node, or one of the two purely-visual annotation kinds. `isAnnotationNode` is the one place that distinguishes them at runtime. */
export type WorkflowCanvasNode = Node<WorkflowNodeRenderData> | Node<WorkflowAnnotationRenderData>;

export function isAnnotationNode(node: WorkflowCanvasNode): node is Node<WorkflowAnnotationRenderData> {
  return node.type === WORKFLOW_COMMENT_RENDER_TYPE || node.type === WORKFLOW_GROUP_RENDER_TYPE;
}

export function toReactFlowNode(node: WorkflowNode, selected: boolean): Node<WorkflowNodeRenderData> {
  return {
    id: node.id,
    type: WORKFLOW_NODE_RENDER_TYPE,
    position: node.position,
    selected,
    data: { kind: node.kind, nodeTypeId: node.nodeTypeId, label: node.label, data: node.data },
  };
}

export function toReactFlowEdge(edge: WorkflowEdge, selected: boolean): Edge<WorkflowEdgeRenderData> {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.branch,
    type: WORKFLOW_EDGE_RENDER_TYPE,
    selected,
    label: edge.branch ? edge.branch.toUpperCase() : undefined,
    data: { branch: edge.branch },
  };
}

export function toReactFlowAnnotation(annotation: WorkflowAnnotation, selected: boolean): Node<WorkflowAnnotationRenderData> {
  return {
    id: annotation.id,
    type: ANNOTATION_RENDER_TYPE[annotation.kind],
    position: annotation.position,
    selected,
    width: annotation.size.width,
    height: annotation.size.height,
    // Groups render behind real nodes so clicking a node inside a group's frame always hits the node, not the frame.
    zIndex: annotation.kind === "group" ? -1 : 5,
    data: { kind: annotation.kind, text: annotation.text, color: annotation.color },
  };
}

export function fromReactFlowAnnotationNode(node: Node<WorkflowAnnotationRenderData>): WorkflowAnnotation {
  return {
    id: node.id,
    kind: node.data.kind,
    position: node.position,
    size: { width: node.width ?? node.measured?.width ?? 200, height: node.height ?? node.measured?.height ?? 120 },
    text: node.data.text,
    color: node.data.color,
  };
}

export function toReactFlowGraph(graph: WorkflowGraph, selectedNodeIds: ReadonlySet<string>, selectedEdgeIds: ReadonlySet<string>) {
  const annotations = graph.annotations ?? [];
  const groupNodes = annotations.filter((annotation) => annotation.kind === "group").map((annotation) => toReactFlowAnnotation(annotation, selectedNodeIds.has(annotation.id)));
  const commentNodes = annotations.filter((annotation) => annotation.kind === "comment").map((annotation) => toReactFlowAnnotation(annotation, selectedNodeIds.has(annotation.id)));
  const workflowNodes = graph.nodes.map((node) => toReactFlowNode(node, selectedNodeIds.has(node.id)));
  return {
    // Group frames first (rendered behind), then real nodes, then comments on top — matches each kind's own `zIndex` above.
    nodes: [...groupNodes, ...workflowNodes, ...commentNodes] as WorkflowCanvasNode[],
    edges: graph.edges.map((edge) => toReactFlowEdge(edge, selectedEdgeIds.has(edge.id))),
  };
}

export function fromReactFlowNode(node: Node<WorkflowNodeRenderData>): WorkflowNode {
  return {
    id: node.id,
    kind: node.data.kind,
    nodeTypeId: node.data.nodeTypeId,
    position: node.position,
    label: node.data.label,
    data: node.data.data,
  };
}

export function fromReactFlowEdge(edge: Edge<WorkflowEdgeRenderData>): WorkflowEdge {
  const branch = (edge.sourceHandle as WorkflowEdgeBranch | undefined) ?? edge.data?.branch ?? null;
  return {
    id: edge.id,
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    branch,
  };
}
