"use client";

import { Badge } from "@/components/ui/Badge";
import type { WorkflowIssue } from "@/types/workflow";

/** The Step 5 Validation Panel — every issue `validateWorkflow` finds, live against the Editor's own in-progress graph. Publishing is blocked while this list is non-empty. */
export function ValidationPanel({ issues, onSelectNode }: { issues: WorkflowIssue[]; onSelectNode?: (nodeId: string) => void }) {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-[15px] font-semibold text-text">Validation</h3>
        <Badge tone={issues.length === 0 ? "success" : "danger"}>{issues.length === 0 ? "Ready to publish" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}</Badge>
      </div>

      {issues.length === 0 ? (
        <p className="text-xs text-text-muted">No validation issues — this Workflow is ready to publish.</p>
      ) : (
        <ul className="space-y-1.5">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? index}`}>
              <button
                type="button"
                onClick={() => issue.nodeId && onSelectNode?.(issue.nodeId)}
                disabled={!issue.nodeId}
                className="w-full rounded-md border border-danger/30 bg-danger/5 px-2.5 py-2 text-left text-xs text-text disabled:cursor-default"
              >
                <span className="font-medium text-danger">{issue.code.replaceAll("_", " ")}</span>
                <p className="mt-0.5 text-text-muted">{issue.message}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
