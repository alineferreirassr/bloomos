"use client";

import { useEffect, useState } from "react";
import { getProfitabilityData, type ProfitabilityData, type ServiceProfitability } from "@/modules/analytics/profitability/getProfitabilityData";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendWindowPicker } from "@/modules/analytics/components/TrendWindowPicker";
import { formatMoney } from "@/lib/money";
import type { TrendWindowKey } from "@/types/analytics";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ProfitabilityData };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function ServiceTable({ title, rows }: { title: string; rows: ServiceProfitability[] }) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">{title}</h3>
      {rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState title="No services with revenue or cost in this window" description="Assign Services to Events with real payments/expenses to see this breakdown." />
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-muted">
                <th className="pb-2 pr-3 font-normal">Service</th>
                <th className="pb-2 pr-3 font-normal">Revenue</th>
                <th className="pb-2 pr-3 font-normal">Cost</th>
                <th className="pb-2 pr-3 font-normal">Profit</th>
                <th className="pb-2 font-normal">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.serviceId} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-text">{row.name}</td>
                  <td className="py-2 pr-3 tabular-nums text-text-muted">{formatMoney(row.revenueMinor, "USD")}</td>
                  <td className="py-2 pr-3 tabular-nums text-text-muted">{formatMoney(row.costMinor, "USD")}</td>
                  <td className="py-2 pr-3 tabular-nums text-text">{formatMoney(row.profitMinor, "USD")}</td>
                  <td className="py-2 tabular-nums text-text-muted">{formatPercent(row.marginPercent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** v2 Checkpoint 23, Step 3 — Profitability Center. */
export function ProfitabilityPanel() {
  const [windowKey, setWindowKey] = useState<TrendWindowKey>("30d");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () => {
    getProfitabilityData(windowKey).then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey]);

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const d = state.data;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <TrendWindowPicker value={windowKey} onChange={setWindowKey} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Gross Profit</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatMoney(d.grossProfitMinor, "USD")}</p>
          <p className="mt-1 text-xs text-text-muted">Margin {formatPercent(d.grossMarginPercent)} · accrual-basis</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Net Profit</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatMoney(d.netProfitMinor, "USD")}</p>
          <p className="mt-1 text-xs text-text-muted">Margin {formatPercent(d.netMarginPercent)} · cash-basis</p>
        </Card>
        <Card>
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted">Cost per Event</h3>
          <p className="mt-1.5 font-serif text-2xl font-semibold text-text tabular-nums">{formatMoney(d.costPerEventMinor, "USD")}</p>
        </Card>
      </div>
      <ServiceTable title="Most Profitable Services" rows={d.mostProfitableServices} />
      <ServiceTable title="Least Profitable Services" rows={d.leastProfitableServices} />
    </div>
  );
}
