"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { WorkflowVersion } from "@/types/workflow";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Step 11's own Version History — every immutable published version, newest first, each restorable back onto the current draft. */
export function VersionHistoryPanel({ versions, restoringVersion, onRestore }: { versions: WorkflowVersion[]; restoringVersion: number | null; onRestore: (version: number) => void }) {
  return (
    <div className="space-y-2 p-3">
      <h3 className="font-serif text-[15px] font-semibold text-text">Version History</h3>
      {versions.length === 0 ? (
        <p className="text-xs text-text-muted">This Workflow hasn&apos;t been published yet — publish to create version 1.</p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge tone="neutral">v{version.version}</Badge>
                  <span className="truncate text-xs text-text">{version.compiledAutomationIds.length} Automation{version.compiledAutomationIds.length === 1 ? "" : "s"}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-text-muted">{formatDateTime(version.publishedAt)}</p>
              </div>
              <Button type="button" variant="ghost" disabled={restoringVersion === version.version} onClick={() => onRestore(version.version)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
