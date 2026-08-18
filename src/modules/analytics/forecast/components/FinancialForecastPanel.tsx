"use client";

import { useEffect, useState } from "react";
import { getFinancialForecastData, type FinancialForecastData } from "@/modules/analytics/forecast/getFinancialForecastData";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMoney } from "@/lib/money";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: FinancialForecastData };

/** v2 Checkpoint 23, Step 8 — Financial Forecast. */
export function FinancialForecastPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () =>
    getFinancialForecastData().then((result) => {
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          {d.revenueForecast ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-[17px] font-semibold text-text">Revenue Forecast</h3>
                <Badge tone={d.revenueForecast.confidence === "high" ? "success" : d.revenueForecast.confidence === "medium" ? "warning" : "neutral"}>{d.revenueForecast.confidence} confidence</Badge>
              </div>
              <p className="mt-1 text-xs text-text-muted">{d.revenueForecast.note}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {d.revenueForecast.projected.map((p) => (
                  <li key={p.label} className="flex justify-between tabular-nums text-text">
                    <span className="text-text-muted">{p.label}</span>
                    <span>{formatMoney(p.value, "USD")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <h3 className="font-serif text-[17px] font-semibold text-text">Revenue Forecast</h3>
              <p className="mt-2 text-sm text-text-muted">Restricted — ask an Owner or Admin for this figure.</p>
            </>
          )}
        </Card>
        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">Expense Forecast</h3>
          {d.expenseForecast ? (
            <>
              <p className="mt-1 text-xs text-text-muted">{d.expenseForecast.note}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {d.expenseForecast.projected.map((p) => (
                  <li key={p.label} className="flex justify-between tabular-nums text-text">
                    <span className="text-text-muted">{p.label}</span>
                    <span>{formatMoney(p.value, "USD")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">Restricted — ask an Owner or Admin for this figure.</p>
          )}
        </Card>
        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">Cash Flow Forecast</h3>
          {d.cashFlowForecast ? (
            <>
              <p className="mt-1 text-xs text-text-muted">Projected revenue minus projected expenses.</p>
              <ul className="mt-3 space-y-1 text-sm">
                {d.cashFlowForecast.map((p) => (
                  <li key={p.month} className="flex justify-between tabular-nums text-text">
                    <span className="text-text-muted">{p.month}</span>
                    <span className={p.projectedMinor < 0 ? "text-danger" : ""}>{formatMoney(p.projectedMinor, "USD")}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">Restricted — ask an Owner or Admin for this figure.</p>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Predicted Busy Months</h3>
        <p className="mt-1 text-xs text-text-muted">The calendar months with the most events historically — a seasonal repeat prediction, not a fitted trend.</p>
        {d.predictedBusyMonths.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Not enough event history yet" description="Once Events have real dates on record, seasonal patterns will appear here." />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.predictedBusyMonths.map((m) => (
              <Badge key={m.month} tone="accent">
                {m.month} ({m.historicalEventCount})
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Inventory Needs</h3>
        <p className="mt-1 text-xs text-text-muted">Items low in stock with a real, unfulfilled requirement from an event in the next 90 days.</p>
        {d.inventoryNeeds.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Nothing to restock yet" description="Low-stock items reserved for an upcoming event will appear here." />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-text-muted">
                  <th className="pb-2 pr-3 font-normal">Item</th>
                  <th className="pb-2 pr-3 font-normal">Available</th>
                  <th className="pb-2 pr-3 font-normal">Reorder Level</th>
                  <th className="pb-2 font-normal">Needed Soon</th>
                </tr>
              </thead>
              <tbody>
                {d.inventoryNeeds.map((row) => (
                  <tr key={row.itemId} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-3 text-text">{row.itemName}</td>
                    <td className="py-2 pr-3 tabular-nums text-text-muted">{row.quantityAvailable}</td>
                    <td className="py-2 pr-3 tabular-nums text-text-muted">{row.reorderLevel}</td>
                    <td className="py-2 tabular-nums text-danger">{row.neededForUpcomingEvents}</td>
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
