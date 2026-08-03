"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";
import type { WorkflowEdgeRenderData } from "@/modules/workflow/canvas/graphAdapters";

/**
 * One renderer for every edge — a Condition node's own "true"/"false"
 * branch shows as a small colored pill at the edge's midpoint; every other
 * edge renders plainly. Matches `NodeRenderer`'s own "one component, driven
 * by data" shape rather than a per-branch edge type.
 */
export function EdgeRenderer({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, selected, data }: EdgeProps<Edge<WorkflowEdgeRenderData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const branch = data?.branch ?? null;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: selected ? 2.5 : 1.5 }} aria-label={branch ? `Connection, ${branch} branch` : "Connection"} />
      {branch ? (
        <EdgeLabelRenderer>
          <div
            role="note"
            aria-label={`${branch} branch`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            className={`pointer-events-none absolute rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white ${branch === "true" ? "bg-accent" : "bg-danger"}`}
          >
            {branch}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
