"use client";

import { useEffect, useState } from "react";
import { getDashboardMetrics, type DashboardMetric } from "@/lib/data";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; metrics: DashboardMetric[] };

async function loadMetrics(): Promise<LoadState> {
  try {
    const metrics = await getDashboardMetrics();
    return { status: "ready", metrics };
  } catch {
    return { status: "error" };
  }
}

export function DashboardMetrics() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadMetrics().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setState({ status: "loading" });
    loadMetrics().then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[92px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load dashboard metrics." onRetry={retry} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {state.metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
  );
}
