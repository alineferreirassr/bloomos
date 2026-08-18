"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClientIntelligenceData, type ClientIntelligenceData } from "@/modules/analytics/clientIntelligence/getClientIntelligenceData";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMoney } from "@/lib/money";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ClientIntelligenceData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/** v2 Checkpoint 23, Step 5 — Client Intelligence. */
export function ClientIntelligencePanel() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getClientIntelligenceData().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });

  useEffect(() => {
    fetchData();
  }, []);

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const d = state.data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">VIP Clients</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.vipClientCount}</p>
          <p className="mt-1 text-xs text-text-muted">Returning + above-average spend</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Returning / One-time</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">
            {d.returningClientCount} / {d.oneTimeClientCount}
          </p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">High Value Clients</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.highValueClientCount}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Inactive Clients</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.inactiveClientCount}</p>
          <p className="mt-1 text-xs text-text-muted">No activity in 12+ months</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Retention Rate</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.retentionRatePercent)}</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Total Clients</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{d.totalClientCount}</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Clients by Lifetime Value</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="pb-2 pr-3 font-normal">Client</th>
                <th className="pb-2 pr-3 font-normal">Lifetime Value</th>
                <th className="pb-2 pr-3 font-normal">Events</th>
                <th className="pb-2 font-normal">Segment</th>
              </tr>
            </thead>
            <tbody>
              {d.clients.slice(0, 20).map((row) => (
                <tr
                  key={row.clientId}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-hover"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${row.name}`}
                  onClick={() => router.push(`/clients/${row.clientId}`)}
                  onKeyDown={(e) => (e.key === "Enter" ? router.push(`/clients/${row.clientId}`) : undefined)}
                >
                  <td className="py-2 pr-3 text-text">{row.name}</td>
                  <td className="py-2 pr-3 tabular-nums text-text">{row.lifetimeCollectedMinor === null ? "—" : formatMoney(row.lifetimeCollectedMinor, "USD")}</td>
                  <td className="py-2 pr-3 tabular-nums text-text-muted">{row.eventCount}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {row.isVip ? <Badge tone="accent">VIP</Badge> : null}
                      {row.isReturning ? <Badge tone="success">Returning</Badge> : null}
                      {row.isInactive ? <Badge tone="warning">Inactive</Badge> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
