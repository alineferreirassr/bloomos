"use client";

import "@xyflow/react/dist/style.css";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, useReactFlow, type OnSelectionChangeFunc } from "@xyflow/react";
import { useCanvasController, type AddableWorkflowNodeType } from "@/modules/workflow/canvas/useCanvasController";
import { NodeRenderer } from "@/modules/workflow/canvas/NodeRenderer";
import { EdgeRenderer } from "@/modules/workflow/canvas/EdgeRenderer";
import { CommentNode } from "@/modules/workflow/canvas/CommentNode";
import { GroupNode } from "@/modules/workflow/canvas/GroupNode";
import { NodeCatalogProvider } from "@/modules/workflow/canvas/NodeCatalogContext";
import { NodeStatusProvider } from "@/modules/workflow/canvas/NodeStatusContext";
import { AnnotationActionsProvider } from "@/modules/workflow/canvas/AnnotationActionsContext";
import { WORKFLOW_NODE_RENDER_TYPE, WORKFLOW_EDGE_RENDER_TYPE, WORKFLOW_COMMENT_RENDER_TYPE, WORKFLOW_GROUP_RENDER_TYPE } from "@/modules/workflow/canvas/graphAdapters";
import type { WorkflowNodeSummary } from "@/modules/workflow/getWorkflowEditorData";
import type { WorkflowAnnotationKind, WorkflowGraph, WorkflowIssue, WorkflowNodeExecutionStats } from "@/types/workflow";

const nodeTypes = { [WORKFLOW_NODE_RENDER_TYPE]: NodeRenderer, [WORKFLOW_COMMENT_RENDER_TYPE]: CommentNode, [WORKFLOW_GROUP_RENDER_TYPE]: GroupNode };
const edgeTypes = { [WORKFLOW_EDGE_RENDER_TYPE]: EdgeRenderer };

/** The `dataTransfer` MIME type the Node Library panel sets when a palette item's own drag begins — private to this file and that panel, never a generic type another drag source could collide with. */
export const WORKFLOW_NODE_DRAG_MIME_TYPE = "application/bloomos-workflow-node-type-id";

export interface WorkflowCanvasHandle {
  addNode: (definition: AddableWorkflowNodeType, position?: { x: number; y: number }) => void;
  /** v2.0 Checkpoint 39 addendum (Workflow Studio) — drops a new Comment or Group annotation centered in the current viewport. */
  addAnnotation: (kind: WorkflowAnnotationKind) => void;
  duplicateSelected: () => void;
  updateNodeData: (nodeId: string, data: Record<string, string | number | boolean | null>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface WorkflowCanvasProps {
  graph: WorkflowGraph;
  nodeCatalog: WorkflowNodeSummary[];
  onGraphChange: (graph: WorkflowGraph) => void;
  onSelectedNodeIdsChange?: (nodeIds: string[]) => void;
  /** Fired whenever `canUndo`/`canRedo` change — a parent's own Undo/Redo buttons must read this via state, never `ref.current` during render (React forbids reading a ref's value while rendering). */
  onHistoryStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  readOnly?: boolean;
  /** v2.0 Checkpoint 39 addendum (Workflow Studio) — real per-node execution stats and validation issues, both keyed by node id, feeding the Canvas's own status overlay. */
  nodeExecutionStats?: Record<string, WorkflowNodeExecutionStats>;
  issues?: WorkflowIssue[];
}

/**
 * The Step 8 Canvas — the **only** component the Workflow Editor page ever
 * imports for rendering the graph. Every prop and every method on its own
 * imperative handle speaks BloomOS's own domain types
 * (`WorkflowGraph`/`AddableWorkflowNodeType`/`WorkflowNodeSummary`/plain
 * node ids); nothing about `@xyflow/react` leaks past this file. React Flow
 * itself supplies only rendering and interaction — pan, zoom, drag,
 * connect, selection, delete (via its own `deleteKeyCode`);
 * duplicate/undo/redo/grid-snapping are this layer's own additions, via
 * `useCanvasController` and the keyboard handler below. `nodeCatalog` is
 * the safe, server-fetched, function-free node type list — see
 * `NodeCatalogContext`'s own doc comment for why this never reads the real
 * Node Registry directly.
 */
const WorkflowCanvasInner = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(function WorkflowCanvasInner(
  { graph, nodeCatalog, onGraphChange, onSelectedNodeIdsChange, onHistoryStateChange, readOnly = false, nodeExecutionStats, issues },
  ref,
) {
  const controller = useCanvasController(graph, onGraphChange);
  const reactFlowInstance = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const catalogById = useMemo(() => new Map(nodeCatalog.map((entry) => [entry.id, entry])), [nodeCatalog]);

  const selectedNodeIds = useMemo(() => controller.nodes.filter((node) => node.selected).map((node) => node.id), [controller.nodes]);

  useEffect(() => {
    onHistoryStateChange?.({ canUndo: controller.canUndo, canRedo: controller.canRedo });
  }, [controller.canUndo, controller.canRedo, onHistoryStateChange]);

  useImperativeHandle(
    ref,
    () => ({
      addNode: (definition, position) => controller.addNode(definition, position ?? { x: 120, y: 120 }),
      addAnnotation: (kind) => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        const center = rect ? reactFlowInstance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 160, y: 160 };
        controller.addAnnotation(kind, center);
      },
      duplicateSelected: () => controller.duplicateNodes(selectedNodeIds),
      updateNodeData: controller.updateNodeData,
      undo: controller.undo,
      redo: controller.redo,
      canUndo: controller.canUndo,
      canRedo: controller.canRedo,
    }),
    [controller, selectedNodeIds, reactFlowInstance],
  );

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes }) => onSelectedNodeIdsChange?.(nodes.map((node) => node.id)),
    [onSelectedNodeIdsChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (readOnly) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        controller.redo();
      } else if (key === "z") {
        event.preventDefault();
        controller.undo();
      } else if (key === "d") {
        event.preventDefault();
        controller.duplicateNodes(selectedNodeIds);
      }
    },
    [readOnly, controller, selectedNodeIds],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => event.preventDefault(), []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) return;
      const nodeTypeId = event.dataTransfer.getData(WORKFLOW_NODE_DRAG_MIME_TYPE);
      const definition = nodeTypeId ? catalogById.get(nodeTypeId) : undefined;
      if (!definition || !wrapperRef.current) return;
      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      controller.addNode(definition, position);
    },
    [readOnly, reactFlowInstance, controller, catalogById],
  );

  const annotationActions = useMemo(() => ({ updateAnnotationData: controller.updateAnnotationData, readOnly }), [controller.updateAnnotationData, readOnly]);

  return (
    <NodeCatalogProvider catalog={nodeCatalog}>
      <NodeStatusProvider nodeExecutionStats={nodeExecutionStats ?? {}} issues={issues ?? []}>
        <AnnotationActionsProvider actions={annotationActions}>
          <div ref={wrapperRef} className="h-full w-full" onKeyDown={handleKeyDown} onDrop={handleDrop} onDragOver={handleDragOver} tabIndex={0} role="application" aria-label="Workflow canvas">
            <ReactFlow
              nodes={controller.nodes}
              edges={controller.edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={controller.onNodesChange}
              onEdgesChange={controller.onEdgesChange}
              onConnect={controller.onConnect}
              onNodeDragStop={controller.onNodeDragStop}
              onSelectionChange={handleSelectionChange}
              snapToGrid
              snapGrid={[16, 16]}
              deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} />
              <Controls showInteractive={!readOnly} />
              <MiniMap pannable zoomable className="!bg-background" />
            </ReactFlow>
          </div>
        </AnnotationActionsProvider>
      </NodeStatusProvider>
    </NodeCatalogProvider>
  );
});

export const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(function WorkflowCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
