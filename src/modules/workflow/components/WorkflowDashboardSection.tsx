"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { getWorkflowDashboardData, type WorkflowDashboardData } from "@/modules/workflow/getWorkflowDashboardData";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: WorkflowDashboardData };

/**
 * The Step 13 Workflow Dashboard: Workflow Statistics, Published/Drafts
 * counts, Validation Errors, and Automation Usage — the same section that
 * doubles as "Execution Links," since every count here links straight back
 * to `/automation` (the Automation Engine's own Dashboard, Checkpoint 9),
 * never a second, separately maintained execution view.
 */
export function WorkflowDashboardSection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getWorkflowDashboardData().then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", data: result.data } : { status: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return <Skeleton className="mt-4 h-24 w-full" />;
  if (state.status === "error") return null;

  const { data } = state;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Workflow Statistics</h3>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Total" value={data.totalWorkflows} />
          <Stat label="Published" value={data.publishedCount} />
          <Stat label="Drafts" value={data.draftCount} />
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Validation Errors</h3>
        {data.workflowsWithValidationErrors.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No draft Workflow currently has a validation issue.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {data.workflowsWithValidationErrors.map((entry) => (
              <li key={entry.workflowId} className="flex items-center justify-between gap-2">
                <Link href={`/workflows/${entry.workflowId}`} className="truncate text-accent hover:underline">
                  {entry.workflowName}
                </Link>
                <span className="text-text-muted">
                  {entry.issueCount} issue{entry.issueCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="sm:col-span-2">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[15px] font-semibold text-text">Automation Usage</h3>
          <Link href="/automation" className="text-xs text-accent hover:underline">
            Open Automation Center →
          </Link>
        </div>
        {data.automationUsage.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No Workflow has been published yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {data.automationUsage.map((entry) => (
              <li key={entry.workflowId} className="flex items-center justify-between gap-2">
                <Link href={`/workflows/${entry.workflowId}`} className="truncate text-text hover:underline">
                  {entry.workflowName} <span className="text-text-muted">v{entry.version}</span>
                </Link>
                <span className="text-xs text-text-muted">
                  {entry.automationCount} Automation{entry.automationCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-lg font-semibold tabular-nums text-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
