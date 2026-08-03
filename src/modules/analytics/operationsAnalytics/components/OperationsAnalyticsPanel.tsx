"use client";

import { useEffect, useState } from "react";
import { getOperationsAnalyticsData, type OperationsAnalyticsData } from "@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: OperationsAnalyticsData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(0)}%`;
}

/** v2 Checkpoint 23, Step 7 — Operations Analytics. */
export function OperationsAnalyticsPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getOperationsAnalyticsData().then((result) => {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Team Utilization</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.teamUtilizationPercent)}</p>
          <p className="mt-1 text-xs text-text-muted">Next 14 days</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Vendor Utilization</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.vendorUtilizationPercent)}</p>
          <p className="mt-1 text-xs text-text-muted">Next 14 days</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Late Tasks</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">
            {d.lateTaskCount} / {d.totalChecklistItemCount}
          </p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Operational Efficiency</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatPercent(d.operationalEfficiencyPercent)}</p>
          <p className="mt-1 text-xs text-text-muted">Avg. event health score</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Vendor Performance</h3>
        {d.vendorPerformance.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No vendor purchase activity yet" description="Purchases tied to a Vendor will appear here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Vendor</th>
                  <th className="pb-2 pr-3 font-normal">Purchases</th>
                  <th className="pb-2 font-normal">Total Spent</th>
                </tr>
              </thead>
              <tbody>
                {d.vendorPerformance.map((row) => (
                  <tr key={row.vendor.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{row.vendor.display_name ?? row.vendor.company_name}</td>
                    <td className="py-2 pr-3 tabular-nums text-text-muted">{row.purchaseCount}</td>
                    <td className="py-2 tabular-nums text-text-muted">{formatMoney(row.totalSpentMinor, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Inventory Usage</h3>
        <p className="mt-1 text-xs text-text-muted">{d.purchaseCount} purchases, {formatMoney(d.totalPurchaseCostMinor, "USD")} total cost.</p>
        {d.inventoryUsage.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No inventory movement yet" description="Reserve or use Inventory items on an Event to see usage here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Item</th>
                  <th className="pb-2 font-normal">Movements</th>
                </tr>
              </thead>
              <tbody>
                {d.inventoryUsage.map((row) => (
                  <tr key={row.itemName} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{row.itemName}</td>
                    <td className="py-2 tabular-nums text-text-muted">{row.movementCount}</td>
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
