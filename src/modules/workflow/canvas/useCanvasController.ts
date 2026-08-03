"use client";

import { useCallback, useState } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import {
  fromReactFlowAnnotationNode,
  fromReactFlowEdge,
  fromReactFlowNode,
  isAnnotationNode,
  toReactFlowAnnotation,
  toReactFlowGraph,
  type WorkflowAnnotationRenderData,
  type WorkflowCanvasNode,
  type WorkflowEdgeRenderData,
  type WorkflowNodeRenderData,
} from "@/modules/workflow/canvas/graphAdapters";
import { generateId } from "@/lib/data/utils";
import type { WorkflowAnnotationKind, WorkflowGraph, WorkflowNodeKind, WorkflowPosition } from "@/types/workflow";

const MAX_HISTORY = 50;

const ANNOTATION_DEFAULT_SIZE: Record<WorkflowAnnotationKind, { width: number; height: number }> = {
  comment: { width: 200, height: 120 },
  group: { width: 320, height: 220 },
};

function toWorkflowGraph(nodes: WorkflowCanvasNode[], edges: Edge<WorkflowEdgeRenderData>[], variables: WorkflowGraph["variables"]): WorkflowGraph {
  const workflowNodes = nodes.filter((node): node is Node<WorkflowNodeRenderData> => !isAnnotationNode(node));
  const annotationNodes = nodes.filter(isAnnotationNode);
  return {
    nodes: workflowNodes.map(fromReactFlowNode),
    edges: edges.map(fromReactFlowEdge),
    variables,
    annotations: annotationNodes.map(fromReactFlowAnnotationNode),
  };
}

/**
 * The minimal shape `addNode` needs to place a new node — deliberately NOT
 * the full `WorkflowNodeDefinition` (which carries a `validate` function
 * and can only ever be read from the real, server-only-adjacent Node
 * Registry). Both `WorkflowNodeDefinition` and the client-safe
 * `WorkflowNodeSummary` (`getWorkflowEditorData.ts`) satisfy this
 * structurally, so callers on either side never need a cast.
 */
export interface AddableWorkflowNodeType {
  id: string;
  kind: WorkflowNodeKind;
  name: string;
}

export interface CanvasController {
  nodes: WorkflowCanvasNode[];
  edges: Edge<WorkflowEdgeRenderData>[];
  onNodesChange: OnNodesChange<WorkflowCanvasNode>;
  onEdgesChange: OnEdgesChange<Edge<WorkflowEdgeRenderData>>;
  onConnect: OnConnect;
  onNodeDragStop: () => void;
  addNode: (definition: AddableWorkflowNodeType, position: WorkflowPosition) => void;
  duplicateNodes: (nodeIds: string[]) => void;
  updateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void;
  /** v2.0 Checkpoint 39 addendum (Workflow Studio) — drops a new "comment" or "group" annotation at `position`, purely visual (see `WorkflowAnnotation`'s own doc comment). */
  addAnnotation: (kind: WorkflowAnnotationKind, position: WorkflowPosition) => void;
  updateAnnotationData: (annotationId: string, patch: Partial<Pick<WorkflowAnnotationRenderData, "text" | "color">>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * The Step 8 Canvas's own controller — the only place `@xyflow/react`'s
 * `useNodesState`/`useEdgesState` are called. Its public surface (this
 * interface) speaks only `WorkflowNodeDefinition`/`WorkflowPosition`/plain
 * ids — a caller (`WorkflowCanvas`) never needs to import an `@xyflow/react`
 * type to use it. Owns its own undo/redo history as two `WorkflowGraph`
 * snapshot stacks (`past`/`future`, real state — not a ref — so
 * `canUndo`/`canRedo` are always safe to read during render), pushed only
 * on a *committed* change (a drag finishing, a node/edge being
 * added/removed/connected/edited) — never on every intermediate
 * pointer-move event a drag fires, so the stack stays meaningful rather
 * than one entry per pixel.
 */
export function useCanvasController(graph: WorkflowGraph, onGraphChange: (graph: WorkflowGraph) => void): CanvasController {
  const initial = toReactFlowGraph(graph, new Set(), new Set());
  const [nodes, setNodes, onNodesChangeInternal] = useNodesState<WorkflowCanvasNode>(initial.nodes);
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState<Edge<WorkflowEdgeRenderData>>(initial.edges);

  const [past, setPast] = useState<WorkflowGraph[]>([]);
  const [future, setFuture] = useState<WorkflowGraph[]>([]);

  const commit = useCallback(
    (nextNodes: WorkflowCanvasNode[], nextEdges: Edge<WorkflowEdgeRenderData>[]) => {
      const nextGraph = toWorkflowGraph(nextNodes, nextEdges, graph.variables);
      setPast((current) => [...current, graph].slice(-MAX_HISTORY));
      setFuture([]);
      onGraphChange(nextGraph);
    },
    [graph, onGraphChange],
  );

  const onNodesChange: OnNodesChange<WorkflowCanvasNode> = useCallback(
    (changes: NodeChange<WorkflowCanvasNode>[]) => {
      onNodesChangeInternal(changes);
      // Commits on removal (immediate) and on a resize's *final* change — NodeResizer
      // (used by the Comment/Group annotation nodes) emits a "dimensions" change with
      // `resizing: false` only once the drag ends, never on every intermediate frame.
      const shouldCommit = changes.some((change) => change.type === "remove" || (change.type === "dimensions" && change.resizing === false));
      if (shouldCommit) {
        setNodes((current) => {
          commit(current, edges);
          return current;
        });
      }
    },
    [onNodesChangeInternal, setNodes, edges, commit],
  );

  const onEdgesChange: OnEdgesChange<Edge<WorkflowEdgeRenderData>> = useCallback(
    (changes: EdgeChange<Edge<WorkflowEdgeRenderData>>[]) => {
      onEdgesChangeInternal(changes);
      if (changes.some((change) => change.type === "remove")) {
        setEdges((current) => {
          commit(nodes, current);
          return current;
        });
      }
    },
    [onEdgesChangeInternal, setEdges, nodes, commit],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const branch = (connection.sourceHandle as "true" | "false" | null) ?? null;
        const next = addEdge({ ...connection, id: generateId("workflow_edge"), type: "workflowEdge", data: { branch }, label: branch ? branch.toUpperCase() : undefined }, current);
        commit(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, commit],
  );

  const onNodeDragStop = useCallback(() => {
    commit(nodes, edges);
  }, [commit, nodes, edges]);

  const addNode = useCallback(
    (definition: AddableWorkflowNodeType, position: WorkflowPosition) => {
      const newNode: Node<WorkflowNodeRenderData> = {
        id: generateId("workflow_node"),
        type: "workflowNode",
        position,
        data: { kind: definition.kind, nodeTypeId: definition.id, label: definition.name, data: {} },
      };
      const next = [...nodes, newNode];
      setNodes(next);
      commit(next, edges);
    },
    [nodes, edges, setNodes, commit],
  );

  const addAnnotation = useCallback(
    (kind: WorkflowAnnotationKind, position: WorkflowPosition) => {
      const size = ANNOTATION_DEFAULT_SIZE[kind];
      const newAnnotation = toReactFlowAnnotation({ id: generateId("workflow_annotation"), kind, position, size, text: kind === "group" ? "New group" : "", color: "neutral" }, true);
      const next = [...nodes.map((node) => ({ ...node, selected: false })), newAnnotation];
      setNodes(next);
      commit(next, edges);
    },
    [nodes, edges, setNodes, commit],
  );

  const duplicateNodes = useCallback(
    (nodeIds: string[]) => {
      const toDuplicate = nodes.filter((node) => nodeIds.includes(node.id));
      if (toDuplicate.length === 0) return;
      const duplicated: WorkflowCanvasNode[] = toDuplicate.map((node) => ({
        ...node,
        id: generateId(isAnnotationNode(node) ? "workflow_annotation" : "workflow_node"),
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        selected: true,
      }));
      const next = [...nodes.map((node) => ({ ...node, selected: false })), ...duplicated];
      setNodes(next);
      commit(next, edges);
    },
    [nodes, edges, setNodes, commit],
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Record<string, string | number | boolean | null>) => {
      const next = nodes.map((node) => {
        if (node.id !== nodeId || isAnnotationNode(node)) return node;
        return { ...node, data: { ...node.data, data } };
      });
      setNodes(next);
      commit(next, edges);
    },
    [nodes, edges, setNodes, commit],
  );

  const updateAnnotationData = useCallback(
    (annotationId: string, patch: Partial<Pick<WorkflowAnnotationRenderData, "text" | "color">>) => {
      const next = nodes.map((node) => {
        if (node.id !== annotationId || !isAnnotationNode(node)) return node;
        return { ...node, data: { ...node.data, ...patch } };
      });
      setNodes(next);
      commit(next, edges);
    },
    [nodes, edges, setNodes, commit],
  );

  const applySnapshot = useCallback(
    (snapshot: WorkflowGraph) => {
      const next = toReactFlowGraph(snapshot, new Set(), new Set());
      setNodes(next.nodes);
      setEdges(next.edges);
      onGraphChange(snapshot);
    },
    [setNodes, setEdges, onGraphChange],
  );

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([graph, ...future].slice(0, MAX_HISTORY));
    applySnapshot(previous);
  }, [past, future, graph, applySnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, graph].slice(-MAX_HISTORY));
    applySnapshot(next);
  }, [past, future, graph, applySnapshot]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeDragStop,
    addNode,
    addAnnotation,
    duplicateNodes,
    updateNodeData,
    updateAnnotationData,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
