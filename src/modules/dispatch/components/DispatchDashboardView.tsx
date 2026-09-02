"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listDispatchOrdersAction, evaluateDispatchPlatformHealthAction, type EvaluateDispatchPlatformHealthResult } from "@/modules/dispatch/dispatchActions";
import type { DispatchOrder, DispatchFindingSeverity } from "@/types/dispatch";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 28, Step 12 — Dispatch Dashboard. Read-only, same
 * discipline `ExecutionPackageDashboardView.tsx`/`OperationalDashboardView.tsx`
 * established: every figure comes straight from
 * `evaluateDispatchPlatformHealthAction`'s already-computed result — no
 * live execution, no GPS, no route optimization. Structural mutation
 * actions (`buildDispatchOrderAction`, `acceptDispatchAssignmentAction`,
 * etc.) exist and are fully tested, but this view only reads and links
 * through to the Dispatch Detail page — the same disclosed "no create/
 * mutate control wired yet" scope every prior platform dashboard in this
 * codebase carries.
 */
const SEVERITY_TONE: Record<DispatchFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<DispatchFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
const DISPATCH_STATUS_TONE: Record<DispatchOrder["status"], BadgeTone> = { draft: "neutral", dispatched: "success", cancelled: "danger", archived: "neutral" };

function FindingRow({ description, severity }: { description: string; severity: DispatchFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function OrderRow({ order, health }: { order: DispatchOrder; health: number | undefined }) {
  return (
    <li role="listitem" className="flex flex-col gap-2 border-b border-border/50 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between md:gap-3 md:py-2">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">Order #{order.id.slice(-8)}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {order.priority} priority · {order.assignments.length} assignment{order.assignments.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {health !== undefined ? <span className="text-xs text-text-muted">Health {health}</span> : null}
        <Badge tone={DISPATCH_STATUS_TONE[order.status]}>{order.status}</Badge>
        <Link href={`/dispatch/${order.id}`} className="ml-auto md:ml-0">
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

export function DispatchDashboardView() {
  const [orders, setOrders] = useState<DispatchOrder[] | null>(null);
  const [health, setHealth] = useState<EvaluateDispatchPlatformHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listDispatchOrdersAction(), evaluateDispatchPlatformHealthAction()]).then(([ordersResult, healthResult]) => {
      if (cancelled) return;
      if (ordersResult.success) setOrders(ordersResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!ordersResult.success) setError(ordersResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [ordersResult, healthResult] = await Promise.all([listDispatchOrdersAction(), evaluateDispatchPlatformHealthAction()]);
    if (ordersResult.success) setOrders(ordersResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!ordersResult.success) setError(ordersResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Dispatch health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedOrders = useMemo(() => (orders ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [orders]);
  const healthByOrderId = useMemo(() => new Map((health?.results ?? []).map((r) => [r.order.id, r.health.overallDispatchHealth] as const)), [health]);
  const readyCount = useMemo(() => (health?.results ?? []).filter((r) => r.validation.valid).length, [health]);

  const averageHealth = useMemo(() => {
    const scores = (health?.results ?? []).map((r) => r.health.overallDispatchHealth);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [health]);

  return (
    <div>
      <PageHeader
        title="Dispatch"
        subtitle="Assigns work from approved Execution Packages — Dispatch never executes work, captures GPS, or optimizes routes."
        icon={VendorsIcon}
        breadcrumb={[{ label: "Dispatch" }]}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Dispatch isn't available" description={error} icon={VendorsIcon} /> : null}

      {orders && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Dispatch Orders" value={String(orders.length)} icon={VendorsIcon} />
            <KpiCard label="Valid for Dispatch" value={String(readyCount)} icon={CheckIcon} />
            <KpiCard label="Findings" value={String(health.findings.length)} icon={AnalyticsIcon} />
            <KpiCard label="Average Dispatch Health" value={averageHealth === null ? "—" : String(averageHealth)} icon={CheckIcon} />
          </div>

          <SectionHeader title="Findings" />
          <LuxuryCard tone="tint" className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Findings <span className="font-normal text-text-muted">({highFindings.length})</span>
            </h2>
            {highFindings.length === 0 ? <p className="text-sm text-success">No high-severity findings.</p> : <ul role="list">{highFindings.map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </LuxuryCard>

          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Findings <span className="font-normal text-text-muted">({otherFindings.length})</span>
            </h2>
            {otherFindings.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherFindings.slice(0, 10).map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </LuxuryCard>

          <SectionHeader title="Dispatch Queue" />
          <LuxuryCard>
            <h2 className="mb-3 text-sm font-semibold">
              Dispatch Orders <span className="font-normal text-text-muted">({sortedOrders.length})</span>
            </h2>
            {sortedOrders.length === 0 ? (
              <EmptyState title="No dispatch orders yet" description="Dispatch orders are built from an approved, ready Execution Package through the module action layer." icon={VendorsIcon} />
            ) : (
              <ul role="list">
                {sortedOrders.slice(0, 25).map((o) => (
                  <OrderRow key={o.id} order={o} health={healthByOrderId.get(o.id)} />
                ))}
              </ul>
            )}
          </LuxuryCard>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading dispatch health…</p>
      ) : null}
    </div>
  );
}
