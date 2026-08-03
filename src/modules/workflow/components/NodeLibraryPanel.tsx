"use client";

import { createElement } from "react";
import { Card } from "@/components/ui/Card";
import { resolveNodeIcon } from "@/modules/workflow/canvas/nodeIcons";
import { resolveNodeColorClasses } from "@/modules/workflow/canvas/nodeColors";
import { WORKFLOW_NODE_DRAG_MIME_TYPE } from "@/modules/workflow/canvas/WorkflowCanvas";
import { WORKFLOW_NODE_CATEGORIES, type WorkflowNodeCategory } from "@/types/workflow";
import type { WorkflowNodeSummary } from "@/modules/workflow/getWorkflowEditorData";

const CATEGORY_LABEL: Record<WorkflowNodeCategory, string> = {
  control: "Control",
  trigger: "Triggers",
  condition: "Conditions",
  approval: "Approval",
  action: "Actions",
};

/**
 * The Step 9 Node Library — every node type this member may use, grouped
 * by category, driven entirely by the workspace-filtered catalog
 * (`listWorkflowNodesForWorkspace`, Step 15's own "Role aware. Feature Flag
 * aware."). Drag onto the canvas (`WORKFLOW_NODE_DRAG_MIME_TYPE`), or click
 * to add at a default position — no per-node-type code lives here, only a
 * generic render driven by each entry's own icon/color/name (Step 3's "no
 * hardcoded node rendering").
 */
export function NodeLibraryPanel({ nodeCatalog, onAddNode }: { nodeCatalog: WorkflowNodeSummary[]; onAddNode: (nodeTypeId: string) => void }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <h3 className="font-serif text-[15px] font-semibold text-text">Node Library</h3>
      {WORKFLOW_NODE_CATEGORIES.filter((category) => category !== "control").map((category) => {
        const entries = nodeCatalog.filter((entry) => entry.category === category);
        if (entries.length === 0) return null;
        return (
          <div key={category}>
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{CATEGORY_LABEL[category]}</h4>
            <div className="mt-1.5 space-y-1.5">
              {entries.map((entry) => (
                <NodeLibraryItem key={entry.id} entry={entry} onAdd={() => onAddNode(entry.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NodeLibraryItem({ entry, onAdd }: { entry: WorkflowNodeSummary; onAdd: () => void }) {
  const colors = resolveNodeColorClasses(entry.color);
  const iconElement = createElement(resolveNodeIcon(entry.icon), { className: "h-3.5 w-3.5", "aria-hidden": true });

  return (
    <Card
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(event) => event.dataTransfer.setData(WORKFLOW_NODE_DRAG_MIME_TYPE, entry.id)}
      onClick={onAdd}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAdd();
        }
      }}
      className={`flex cursor-grab items-center gap-2 p-2 transition-colors hover:bg-text/5 active:cursor-grabbing ${colors.border}`}
      aria-label={`Add ${entry.name} node`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${colors.chip}`}>{iconElement}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text">{entry.name}</p>
        <p className="truncate text-[10px] text-text-muted">{entry.description}</p>
      </div>
    </Card>
  );
}
