"use client";

import { useEffect, useState } from "react";
import { getSalesFunnelData, type SalesFunnelData } from "@/modules/analytics/funnel/getSalesFunnelData";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: SalesFunnelData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/** v2 Checkpoint 23, Step 4 — Sales Funnel Analytics. */
export function SalesFunnelPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getSalesFunnelData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const d = state.data;
  const maxCount = Math.max(1, ...d.stages.map((s) => s.count));

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Pipeline Snapshot</h3>
        <p className="mt-1 text-xs text-text-muted">How many leads currently sit at each stage — a snapshot, not a cohort funnel (see the Known Limitations in the Business Intelligence docs).</p>
        <div className="mt-4 space-y-2">
          {d.stages.map((stage) => (
            <div key={stage.columnId} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-text">{stage.label}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(stage.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-text-muted">{stage.count}</span>
              {d.mostStalledStage?.columnId === stage.columnId ? <Badge tone="warning">Stalled</Badge> : null}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Won / Lost</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">
            {d.wonCount} / {d.lostCount}
          </p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Conversion Rate</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.conversionRatePercent)}</p>
          <p className="mt-1 text-xs text-text-muted">Of all leads</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Win Rate</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.decidedWinRatePercent)}</p>
          <p className="mt-1 text-xs text-text-muted">Of decided leads</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Avg. Time to Convert</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.averageDaysToConvertLead === null ? "—" : `${Math.round(d.averageDaysToConvertLead)}d`}</p>
        </Card>
      </div>
    </div>
  );
}
