"use client";

import { useEffect, useState } from "react";
import { getEventIntelligenceData, type EventIntelligenceData } from "@/modules/analytics/eventIntelligence/getEventIntelligenceData";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: EventIntelligenceData };

function formatNumber(value: number | null, digits = 0): string {
  return value === null ? "—" : value.toFixed(digits);
}

/** v2 Checkpoint 23, Step 6 — Event Intelligence. */
export function EventIntelligencePanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getEventIntelligenceData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const d = state.data;
  const maxSeasonCount = Math.max(1, ...d.seasonality.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Cancellation Rate</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.cancellationRatePercent.toFixed(1)}%</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Avg. Planning Time</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.averagePlanningDays === null ? "—" : `${Math.round(d.averagePlanningDays)}d`}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Avg. Event Size</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatNumber(d.averageEventSize)}</p>
          <p className="mt-1 text-xs text-text-muted">Guests</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Avg. Duration</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.averageDurationHours === null ? "—" : `${d.averageDurationHours.toFixed(1)}h`}</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Seasonality</h3>
        <p className="mt-1 text-xs text-text-muted">Events by month, summed across every year on record.</p>
        <div className="mt-4 flex items-end gap-2">
          {d.seasonality.map((point) => (
            <div key={point.month} className="flex flex-1 flex-col items-center gap-1" role="img" aria-label={`${point.month}: ${point.count} event${point.count === 1 ? "" : "s"}`}>
              <div className="flex h-24 w-full items-end" aria-hidden="true">
                <div className="w-full rounded-t bg-accent" style={{ height: `${(point.count / maxSeasonCount) * 100}%` }} />
              </div>
              <span className="text-xs text-text-muted" aria-hidden="true">
                {point.month}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Popular Services</h3>
        {d.popularServices.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No services assigned yet" description="Assign Services to Events to see which ones are most popular." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Service</th>
                  <th className="pb-2 font-normal">Events</th>
                </tr>
              </thead>
              <tbody>
                {d.popularServices.map((row) => (
                  <tr key={row.serviceId} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{row.name}</td>
                    <td className="py-2 tabular-nums text-text-muted">{row.eventCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
