"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import { getOperationsDashboardData, type OperationsDashboardData } from "@/modules/operations/operationsDashboardData";

type LoadState = { status: "loading" } | { status: "ready"; data: OperationsDashboardData } | { status: "error" };

function healthTone(score: number): BadgeTone {
  if (score >= 90) return "success";
  if (score >= 70) return "accent";
  if (score >= 45) return "warning";
  return "danger";
}

/**
 * v2 Checkpoint 21, Step 13 — the workspace-wide Operations Dashboard.
 * Events Today, Upcoming Events, Late Tasks, Inventory/Purchase/Vendor
 * Alerts, Payments, and Health Scores across every active event — every
 * figure sourced from `getOperationsDashboardData()`, never fabricated.
 */
export function OperationsDashboardView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getOperationsDashboardData().then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  };

  useEffect(() => {
    let cancelled = false;
    getOperationsDashboardData().then(
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
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load the Operations Dashboard." onRetry={load} />;
  }

  const { data } = state;

  return (
    <div className="space-y-8">
      <PageHeader title="Operations Dashboard" subtitle="Everything operational across every active event, in one place." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Events Today" value={String(data.eventsToday.length)} href="/events" />
        <MetricCard label="Upcoming (14d)" value={String(data.upcomingEvents.length)} href="/events" />
        <MetricCard label="Late Tasks" value={String(data.lateTaskCount)} href="/events" />
        <MetricCard label="Inventory Alerts" value={String(data.lowStockItems.length + data.damagedItems.length)} href="/inventory" />
        <MetricCard label="Purchase Alerts" value={String(data.overduePurchases.length)} href="/purchases" />
        <MetricCard label="Vendor Alerts" value={String(data.unconfirmedVendorAssignmentCount)} href="/vendors" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LuxuryCard>
          <h3 className="font-serif text-[17px] font-semibold text-text">Events Today</h3>
          {data.eventsToday.length === 0 ? (
            <EmptyState title="No events today" description="Nothing scheduled for today." />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.eventsToday.map((event) => (
                <li key={event.id}>
                  <Link href={`/events/${event.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-accent-100/25">
                    <span className="text-text">{event.title}</span>
                    <span className="text-text-muted">{event.location_name ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h3 className="font-serif text-[17px] font-semibold text-text">Upcoming Events (next 14 days)</h3>
          {data.upcomingEvents.length === 0 ? (
            <EmptyState title="Nothing upcoming" description="No events in the next 14 days." />
          ) : (
            <ul className="mt-3 space-y-2">
              {data.upcomingEvents.slice(0, 8).map((event) => (
                <li key={event.id}>
                  <Link href={`/events/${event.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-accent-100/25">
                    <span className="text-text">{event.title}</span>
                    <span className="text-text-muted">{formatEventDate(event.event_date)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
      </div>

      <LuxuryCard>
        <h3 className="font-serif text-[17px] font-semibold text-text">Health Scores — Upcoming Events</h3>
        {data.eventHealthScores.length === 0 ? (
          <EmptyState title="Nothing to score" description="No upcoming events in the next 14 days." />
        ) : (
          <ul className="mt-3 space-y-1">
            {data.eventHealthScores.map(({ event, score }) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-accent-100/25">
                  <span className="text-text">{event.title}</span>
                  <Badge tone={healthTone(score)}>{score}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LuxuryCard>
          <h3 className="font-serif text-[17px] font-semibold text-text">Inventory Alerts</h3>
          {data.lowStockItems.length === 0 && data.damagedItems.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No inventory alerts.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.lowStockItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span className="text-text">{item.name}</span>
                  <Badge tone="warning">Low stock</Badge>
                </li>
              ))}
              {data.damagedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span className="text-text">{item.name}</span>
                  <Badge tone="danger">Damaged</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h3 className="font-serif text-[17px] font-semibold text-text">Purchase Alerts</h3>
          {data.overduePurchases.length === 0 ? (
            <p className="mt-2 text-sm text-text-muted">No overdue purchase orders.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {data.overduePurchases.map((purchase) => (
                <li key={purchase.id} className="flex items-center justify-between">
                  <span className="text-text">{purchase.purchase_number}</span>
                  <Badge tone="danger">Overdue</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
      </div>

      <LuxuryCard>
        <h3 className="font-serif text-[17px] font-semibold text-text">Payments</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Outstanding receivables</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.outstanding_receivables_minor, "USD")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Overdue receivables</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.overdue_receivables_minor, "USD")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Deposits pending</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.deposits_pending_minor, "USD")}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Collected this month</dt>
            <dd className="text-sm font-medium text-text">{formatMoney(data.financialSummary.collected_this_month_minor, "USD")}</dd>
          </div>
        </dl>
      </LuxuryCard>
    </div>
  );
}
