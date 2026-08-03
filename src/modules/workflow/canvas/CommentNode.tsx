"use client";

import { useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { useAnnotationActions } from "@/modules/workflow/canvas/AnnotationActionsContext";
import { resolveNodeColorClasses } from "@/modules/workflow/canvas/nodeColors";
import type { WorkflowAnnotationRenderData } from "@/modules/workflow/canvas/graphAdapters";

const COMMENT_COLORS = ["neutral", "accent", "warning", "danger", "success"] as const;

/**
 * v2.0 Checkpoint 39 addendum (Workflow Studio) — a sticky-note annotation.
 * Purely visual: its own text/color live in `WorkflowAnnotation`, never in
 * `WorkflowNode.data`, so it can never be picked up by the Compiler,
 * Validation Engine, or Simulator (all three only ever read `graph.nodes`).
 * Text commits on blur, mirroring the existing `CustomActionFields` label
 * pattern in `PropertiesPanel.tsx` — local state while typing, one
 * `updateAnnotationData` call (and one undo step) when the author is done.
 */
export function CommentNode({ id, data, selected }: NodeProps<Node<WorkflowAnnotationRenderData>>) {
  const { updateAnnotationData, readOnly } = useAnnotationActions();
  const [text, setText] = useState(data.text);
  // Re-syncs local state from the annotation's own text during render (not an Effect) when
  // it changes out from under this instance — e.g. an undo/redo restoring a prior snapshot.
  const [syncedText, setSyncedText] = useState(data.text);
  if (data.text !== syncedText) {
    setSyncedText(data.text);
    setText(data.text);
  }
  const colors = resolveNodeColorClasses(data.color);

  return (
    <div className={`flex h-full w-full flex-col rounded-md border-2 ${colors.border} ${colors.chip} p-2 shadow-sm`}>
      <NodeResizer isVisible={selected && !readOnly} minWidth={140} minHeight={90} />
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">Comment</span>
        {!readOnly ? (
          <div className="flex gap-1">
            {COMMENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Set comment color to ${color}`}
                aria-pressed={data.color === color}
                onClick={() => updateAnnotationData(id, { color })}
                className={`h-3 w-3 rounded-full border border-text/30 ${resolveNodeColorClasses(color).chip} ${data.color === color ? "ring-1 ring-text" : ""}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <textarea
        className="nodrag h-full w-full flex-1 resize-none border-0 bg-transparent text-[12px] text-text outline-none placeholder:opacity-60"
        value={text}
        placeholder="Write a comment…"
        readOnly={readOnly}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text !== data.text) updateAnnotationData(id, { text });
        }}
        aria-label="Comment text"
      />
    </div>
  );
}
