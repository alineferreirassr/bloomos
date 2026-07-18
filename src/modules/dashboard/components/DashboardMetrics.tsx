"use client";

import { useEffect, useState } from "react";
import { getDashboardMetrics, type DashboardMetric } from "@/lib/data";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { canAccessRoute } from "@/core/permissions/routeAccess";
import { PendingInvitationsCard } from "@/modules/dashboard/components/PendingInvitationsCard";

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
  const { can } = useMemberSession();
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

  // Every card links somewhere (`metric.href`) — hiding a card the member
  // can't view reuses that same link's route requirement rather than a
  // second, metric-specific permission mapping. This filters what's
  // *rendered*, not what was fetched — `getDashboardMetrics()` still
  // computes every module's figures in one call today (business-module RLS
  // itself remains Workspace-isolation-only this phase, see
  // docs/permissions.md), so this is a real UI improvement, not a data-layer
  // access boundary; the underlying values already reach any Workspace
  // member's authenticated session via RLS regardless of role.
  const visibleMetrics = state.metrics.filter((metric) => canAccessRoute(metric.href, can));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {visibleMetrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
      <PendingInvitationsCard />
    </div>
  );
}
