"use client";

import { useEffect, useState } from "react";
import { getRevenueBreakdown } from "@/modules/analytics/revenue/getRevenueBreakdown";
import { RevenueTrendChart } from "@/modules/analytics/components/RevenueTrendChart";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/money";
import type { RevenueBreakdown } from "@/types/businessIntelligence";

type LoadState = { status: "loading" } | { status: "restricted" } | { status: "ready"; data: RevenueBreakdown };

/**
 * Phase 08 — "Performance Story": one real chart, not a wall of KPI cards.
 * Reuses `getRevenueBreakdown`'s existing "month" dimension (the same cash
 * actually collected figure the Executive tab's Revenue widgets show) over
 * the trailing year — no new metric definition, no fabricated trend.
 */
export function PerformanceStorySection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    getRevenueBreakdown("month", "year").then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "restricted" });
    });
  }, []);

  if (state.status === "loading") {
    return (
      <Card>
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (state.status === "restricted") {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Performance Story</h3>
        <p className="mt-1 text-xs text-text-muted">Restricted — ask an Owner or Admin to see the revenue trend.</p>
      </Card>
    );
  }

  const currency = "usd";
  const rows = state.data.rows.map((row) => ({ label: row.label, revenueMinor: row.revenueMinor }));
  const hasRevenue = state.data.totalMinor > 0;

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Performance Story</h3>
      <p className="mt-1 text-xs text-text-muted">
        {hasRevenue ? `${formatMoney(state.data.totalMinor, currency)} collected over the trailing year.` : "No revenue collected yet over the trailing year."}
      </p>
      {hasRevenue ? (
        <div className="mt-4">
          <RevenueTrendChart rows={rows} currency={currency} />
        </div>
      ) : null}
    </Card>
  );
}
