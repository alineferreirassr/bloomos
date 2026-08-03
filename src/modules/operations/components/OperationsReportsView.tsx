"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { formatMoney } from "@/lib/money";
import { getOperationsReportsData, type OperationsReportsData } from "@/modules/operations/operationsReportsData";

type LoadState = { status: "loading" } | { status: "ready"; data: OperationsReportsData } | { status: "error" };

/**
 * v2 Checkpoint 21, Step 16 — Operations Reports: Completed Events, Profit,
 * Vendor Performance, Inventory Usage, Purchases, Expenses. Every figure is
 * sourced from `getOperationsReportsData()`, bounded to keep the fan-out
 * reasonable (see that module's own doc comment for exactly what's capped).
 */
export function OperationsReportsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getOperationsReportsData().then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  };

  useEffect(() => {
    let cancelled = false;
    getOperationsReportsData().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load Operations Reports." onRetry={load} />;
  }

  const { data } = state;

  return (
    <div className="space-y-6">
      <PageHeader title="Operations Reports" subtitle="Completed Events, Profit, Vendor Performance, Inventory Usage, Purchases, and Expenses." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Completed Events" value={String(data.completedEvents.length)} href="/events" />
        <MetricCard label="Gross Profit" value={formatMoney(data.totalGrossProfitMinor, "USD")} href="/finance" />
        <MetricCard label="Net Profit" value={formatMoney(data.totalNetProfitMinor, "USD")} href="/finance" />
        <MetricCard label="Purchase Orders" value={String(data.purchaseCount)} href="/purchases" />
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Completed Events (most recent 25)</h3>
        {data.completedEvents.length === 0 ? (
          <EmptyState title="No completed events yet" description="Completed events will appear here once they're marked complete." />
        ) : (
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.completedEvents.map((event) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="text-accent hover:underline">
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">Vendor Performance</h3>
          {data.vendorPerformance.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No vendor purchase history yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.vendorPerformance.map((row) => (
                <li key={row.vendor.id} className="flex items-center justify-between">
                  <span className="text-text">{row.vendor.company_name}</span>
                  <span className="text-text-muted">
                    {row.purchaseCount} orders · {formatMoney(row.totalSpentMinor, "USD")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-serif text-[17px] font-semibold text-text">Inventory Usage</h3>
          {data.inventoryUsage.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No inventory movement history yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.inventoryUsage.map((row) => (
                <li key={row.itemName} className="flex items-center justify-between">
                  <span className="text-text">{row.itemName}</span>
                  <span className="text-text-muted">{row.movementCount} movements</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Expenses</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">Expenses this month</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.expenses_this_month_minor, "USD")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Gross profit (workspace, this month)</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.gross_profit_minor, "USD")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Net profit (workspace, this month)</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.net_profit_minor, "USD")}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <p className="text-xs text-text-muted">
          Team Performance isn&apos;t shown here — this codebase has no aggregated index of completed checklist items by team member, only free-text assignment on each item.
        </p>
      </Card>
    </div>
  );
}
