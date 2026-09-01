"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getOperationsAnalyticsData, type OperationsAnalyticsData } from "@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: OperationsAnalyticsData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

/**
 * Phase 08 — "Operational Insights": summarized, not duplicated. Reuses
 * `getOperationsAnalyticsData()` wholesale (the same action the Operations
 * tab renders in full) rather than re-fetching or re-deriving anything.
 * Deliberately omits `totalPurchaseCostMinor` here — that field isn't yet
 * gated on `finance.amounts.view` (a pre-existing gap outside this phase's
 * scope), so this restrained summary sticks to non-financial figures only.
 */
export function OperationalInsightsSection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getOperationsAnalyticsData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <ErrorState message={state.message} onRetry={fetchData} />
      </Card>
    );
  }

  const d = state.data;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-[17px] font-semibold text-text">Operational Insights</h3>
        <Link href="/operations" className="text-xs text-accent hover:underline">
          Open Operations →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-text-muted">Late tasks</p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-text tabular-nums">{d.lateTaskCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Team utilization</p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-text tabular-nums">{formatPercent(d.teamUtilizationPercent)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Vendor utilization</p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-text tabular-nums">{formatPercent(d.vendorUtilizationPercent)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Avg. event health</p>
          <p className="mt-0.5 font-serif text-lg font-semibold text-text tabular-nums">{d.averageEventHealthScore === null ? "—" : d.averageEventHealthScore.toFixed(0)}</p>
        </div>
      </div>
    </Card>
  );
}
