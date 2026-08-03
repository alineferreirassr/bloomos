"use client";

import { useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useAnnotationActions } from "@/modules/workflow/canvas/AnnotationActionsContext";
import { resolveNodeColorClasses } from "@/modules/workflow/canvas/nodeColors";
import type { WorkflowAnnotationRenderData } from "@/modules/workflow/canvas/graphAdapters";

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — a labeled frame an author
 * draws around related nodes to organize a large graph. Rendered with a
 * negative `zIndex` (see `toReactFlowAnnotation`) so it always sits behind
 * real graph nodes — clicking a node inside the frame always hits the node,
 * never the frame. This is a **visual grouping only**: it does not reparent
 * the nodes drawn inside it (no `parentId`), so dragging the frame moves
 * only the frame, never its contents — the deliberately simple, "nothing
 * new to the graph model" reading of "node grouping" from the addendum.
 */
export function GroupNode({ id, data, selected }: NodeProps<Node<WorkflowAnnotationRenderData>>) {
  const { updateAnnotationData, readOnly } = useAnnotationActions();
  const [label, setLabel] = useState(data.text);
  // Re-syncs local state from the annotation's own text during render (not an Effect) when
  // it changes out from under this instance — e.g. an undo/redo restoring a prior snapshot.
  const [syncedText, setSyncedText] = useState(data.text);
  if (data.text !== syncedText) {
    setSyncedText(data.text);
    setLabel(data.text);
  }
  const colors = resolveNodeColorClasses(data.color);

  return (
    <div className={`relative h-full w-full rounded-lg border-2 border-dashed ${colors.border} bg-transparent`}>
      <NodeResizer isVisible={selected && !readOnly} minWidth={220} minHeight={140} lineClassName={colors.border} handleClassName={`${colors.chip} !h-2.5 !w-2.5 !rounded-sm`} />
      <input
        className={`nodrag absolute -top-6 left-0 max-w-full rounded border-0 bg-transparent px-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted outline-none ${!readOnly ? "hover:bg-background/60 focus:bg-background" : ""}`}
        value={label}
        placeholder="Group name"
        readOnly={readOnly}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() => {
          if (label !== data.text) updateAnnotationData(id, { text: label });
        }}
        aria-label="Group name"
      />
    </div>
  );
}
