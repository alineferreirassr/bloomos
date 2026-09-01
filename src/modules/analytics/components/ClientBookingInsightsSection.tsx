"use client";

import { useEffect, useState } from "react";
import { getBenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import type { BenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: BenchmarkData };

function thisMonthValue(result: BenchmarkData["eventsBooked"] | BenchmarkData["newClients"]): number {
  return result.values.find((v) => v.period === "thisMonth")?.value ?? 0;
}

function formatChange(percent: number | null): string {
  if (percent === null) return "";
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(0)}% vs. last month`;
}

/**
 * Phase 08 — "Client/Booking Insights": a restrained, real summary reusing
 * `getBenchmarkData()`'s already-computed thisMonth figures, not a second
 * copy of the full Benchmark table (that stays in the Benchmark tab).
 */
export function ClientBookingInsightsSection() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getBenchmarkData().then((result) => {
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

  const { eventsBooked, newClients } = state.data;

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Client &amp; Booking Insights</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-text-muted">Events booked this month</p>
          <p className="mt-0.5 font-serif text-xl font-semibold text-text tabular-nums">{thisMonthValue(eventsBooked).toLocaleString()}</p>
          <p className="text-xs text-text-muted">{formatChange(eventsBooked.changeVsLastMonthPercent)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">New clients this month</p>
          <p className="mt-0.5 font-serif text-xl font-semibold text-text tabular-nums">{thisMonthValue(newClients).toLocaleString()}</p>
          <p className="text-xs text-text-muted">{formatChange(newClients.changeVsLastMonthPercent)}</p>
        </div>
      </div>
    </Card>
  );
}
