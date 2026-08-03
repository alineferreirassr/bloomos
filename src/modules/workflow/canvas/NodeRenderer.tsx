"use client";

import { createElement } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useNodeCatalogEntry } from "@/modules/workflow/canvas/NodeCatalogContext";
import { useNodeStatus } from "@/modules/workflow/canvas/NodeStatusContext";
import { resolveNodeIcon } from "@/modules/workflow/canvas/nodeIcons";
import { resolveNodeColorClasses } from "@/modules/workflow/canvas/nodeColors";
import type { WorkflowNodeRenderData } from "@/modules/workflow/canvas/graphAdapters";

const STATUS_DOT_CLASS: Record<string, string> = {
  success: "bg-success",
  failure: "bg-danger",
  partial_failure: "bg-warning",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The Step 3 "no hardcoded node rendering" guarantee in practice — **one**
 * component renders every node kind and every node type. Everything that
 * varies (icon, color, category label) is read from the safe, server-fetched
 * `WorkflowNodeSummary` catalog (`NodeCatalogContext`) via `nodeTypeId` —
 * never the real `core/workflow/nodeRegistry` directly, which can't be
 * imported client-side (see that Context's own doc comment). A brand-new
 * node type needs zero changes here to render correctly (Step 17's own
 * Developer Experience promise) — only its own registration.
 */
export function NodeRenderer({ id, data, selected }: NodeProps<Node<WorkflowNodeRenderData>>) {
  const definition = useNodeCatalogEntry(data.nodeTypeId);
  const { stats, issueCount } = useNodeStatus(id);
  // Rendered via `createElement` rather than a `<Icon />` JSX tag —
  // `resolveNodeIcon` is a static lookup table, never a component factory,
  // but the React Compiler's static-components lint rule can't verify that
  // for a JSX tag whose identifier was just locally assigned; calling
  // `createElement` directly sidesteps that heuristic without disabling it.
  const iconElement = createElement(resolveNodeIcon(definition?.icon ?? ""), { className: "h-3.5 w-3.5", "aria-hidden": true });
  const colors = resolveNodeColorClasses(definition?.color ?? "neutral");
  const isCondition = data.kind === "condition";
  const hasInput = data.kind !== "start";
  const hasOutput = data.kind !== "end";

  const nodeKindLabel = definition?.category ?? data.kind;
  const statusSuffix = issueCount > 0 ? `, ${issueCount} validation ${issueCount === 1 ? "issue" : "issues"}` : stats ? `, executed ${stats.executionCount} times` : "";

  return (
    <div
      role="group"
      aria-label={`${nodeKindLabel} node: ${data.label}${selected ? ", selected" : ""}${statusSuffix}`}
      className={`min-w-[190px] rounded-md border-2 bg-background px-3.5 py-2.5 shadow-sm transition-shadow ${colors.border} ${selected ? "shadow-md ring-2 ring-accent/50" : ""}`}
    >
      {hasInput ? <Handle type="target" position={Position.Left} aria-label="Incoming connection" className="!h-2.5 !w-2.5 !border-2 !border-background !bg-text/40" /> : null}

      <div className="flex items-start gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${colors.chip}`}>{iconElement}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-text">{data.label}</p>
          <p className="truncate text-[10px] uppercase tracking-wide text-text-muted">{definition?.name ?? data.nodeTypeId}</p>
        </div>
        {issueCount > 0 ? (
          <span title={`${issueCount} validation ${issueCount === 1 ? "issue" : "issues"}`} className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-background">
            {issueCount}
          </span>
        ) : null}
      </div>

      {stats ? (
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-border/60 pt-1.5 text-[9px] text-text-muted">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[stats.lastStatus ?? ""] ?? "bg-text/30"}`} aria-hidden="true" />
          <span>{stats.executionCount}× run</span>
          <span aria-hidden="true">·</span>
          {stats.averageDurationMs !== null ? <span>{formatDuration(stats.averageDurationMs)} avg</span> : null}
          <span aria-hidden="true">·</span>
          {stats.lastExecutedAt ? <span>{formatRelativeTime(stats.lastExecutedAt)}</span> : null}
        </div>
      ) : null}

      {hasOutput && isCondition ? (
        <>
          <Handle type="source" id="true" position={Position.Right} aria-label="True branch" style={{ top: "35%" }} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-accent" />
          <Handle type="source" id="false" position={Position.Right} aria-label="False branch" style={{ top: "65%" }} className="!h-2.5 !w-2.5 !border-2 !border-background !bg-danger" />
          <div className="mt-1.5 flex justify-between text-[9px] font-semibold uppercase tracking-wide">
            <span className="text-accent">True</span>
            <span className="text-danger">False</span>
          </div>
        </>
      ) : hasOutput ? (
        <Handle type="source" position={Position.Right} aria-label="Outgoing connection" className="!h-2.5 !w-2.5 !border-2 !border-background !bg-text/40" />
      ) : null}
    </div>
  );
}
