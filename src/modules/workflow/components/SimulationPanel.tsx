"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { WorkflowSimulationResult } from "@/types/workflow";

const KIND_TONE: Record<string, "neutral" | "accent" | "warning" | "danger" | "success"> = {
  start: "neutral",
  trigger: "accent",
  condition: "warning",
  approval: "danger",
  action: "success",
  end: "neutral",
};

/**
 * Step 6's own Execution Simulator panel — every path a Publish would
 * compile into its own Automation, walked step by step in plain language.
 * Nothing here ever executes anything; every `preview` string comes
 * straight from `core/workflow/simulator.ts`'s own reuse of the real
 * Compiler's condition/action resolution, so what's shown here can never
 * drift from what Publish would actually produce.
 */
export function SimulationPanel({
  result,
  running,
  onRun,
}: {
  result: WorkflowSimulationResult | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-[15px] font-semibold text-text">Simulation</h3>
        <Button type="button" variant="secondary" onClick={onRun} disabled={running}>
          {running ? "Simulating…" : "Run Simulation"}
        </Button>
      </div>
      <p className="text-xs text-text-muted">Previews every path this Workflow would compile into — nothing here is ever actually executed.</p>

      {result === null ? null : !result.valid ? (
        <p className="text-xs text-danger">This graph has structural issues — fix Validation first, then simulate again.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-[11px] text-text-muted">
            <span>{result.nodeCount} nodes</span>
            <span>{result.triggerCount} triggers</span>
            <span>{result.paths.length} path{result.paths.length === 1 ? "" : "s"}</span>
          </div>

          {result.memoryPreview ? (
            <div className="rounded-md border border-border bg-accent/5 px-2.5 py-2 text-xs text-text-muted">
              A path here touches Memory — this Workspace currently has <span className="font-medium text-text">{result.memoryPreview.approvedCount}</span> approved and{" "}
              <span className="font-medium text-text">{result.memoryPreview.pendingCount}</span> pending Memory entries (read-only, via the real Memory Layer).
            </div>
          ) : null}

          {result.paths.length === 0 ? (
            <p className="text-xs text-text-muted">No Trigger reaches a real path yet — add a Trigger and connect it to at least one step.</p>
          ) : (
            <ul className="space-y-3">
              {result.paths.map((path, pathIndex) => (
                <li key={`${path.triggerNodeId}-${pathIndex}`} className="rounded-md border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-text">
                      Path {pathIndex + 1} — {path.triggerName}
                    </p>
                    <Badge tone="neutral">{path.actionCount} action{path.actionCount === 1 ? "" : "s"}</Badge>
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {path.steps.map((step, stepIndex) => (
                      <li key={step.nodeId} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5 shrink-0 text-text-muted">{stepIndex + 1}.</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge tone={KIND_TONE[step.kind] ?? "neutral"}>{step.kind}</Badge>
                            <span className="font-medium text-text">{step.name}</span>
                            {step.branch ? <Badge tone={step.branch === "true" ? "success" : "neutral"}>{step.branch}</Badge> : null}
                          </div>
                          <p className="mt-0.5 text-text-muted">{step.preview}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
