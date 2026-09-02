"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listAllocationRequestsAction, listResourceBundlesAction, evaluateResourceAllocationHealthAction, type EvaluateResourceAllocationHealthResult } from "@/modules/allocation/allocationActions";
import type { AllocationRequest, ResourceBundle, AllocationFindingSeverity } from "@/types/allocation";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetsIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.1, Step 19 — Allocation Dashboard. Read-only, same
 * discipline `CalendarDashboardView.tsx`/`CapabilityDashboardView.tsx`
 * established: every figure comes straight from
 * `evaluateResourceAllocationHealthAction`'s already-computed result — no
 * worker selection, no dispatch, no AI. `generateAllocationProposalAction`/
 * `approveAllocationAction`/`archiveAllocationAction` exist and are fully
 * tested in `allocationActions.ts`, but — matching the same disclosed
 * "no create/mutate control wired into the dashboard yet" scope every
 * prior platform dashboard in this codebase carries — this view only
 * reads and links through to the Request Detail page.
 */
const SEVERITY_TONE: Record<AllocationFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<AllocationFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };

function FindingRow({ description, severity }: { description: string; severity: AllocationFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function RequestRow({ request }: { request: AllocationRequest }) {
  const lineCount = request.required_resources.reduce((sum, l) => sum + l.quantity, 0);
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{request.context_type.replace(/_/g, " ")} request</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {lineCount} resource{lineCount === 1 ? "" : "s"} needed · {request.priority} priority
        </p>
      </div>
      <Link href={`/allocations/requests/${request.id}`}>
        <Button variant="secondary">View</Button>
      </Link>
    </li>
  );
}

export function AllocationDashboardView() {
  const [requests, setRequests] = useState<AllocationRequest[] | null>(null);
  const [bundles, setBundles] = useState<ResourceBundle[] | null>(null);
  const [health, setHealth] = useState<EvaluateResourceAllocationHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAllocationRequestsAction(), listResourceBundlesAction(), evaluateResourceAllocationHealthAction()]).then(([reqResult, bundleResult, healthResult]) => {
      if (cancelled) return;
      if (reqResult.success) setRequests(reqResult.data);
      if (bundleResult.success) setBundles(bundleResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!reqResult.success) setError(reqResult.error);
      else if (!bundleResult.success) setError(bundleResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [reqResult, bundleResult, healthResult] = await Promise.all([listAllocationRequestsAction(), listResourceBundlesAction(), evaluateResourceAllocationHealthAction()]);
    if (reqResult.success) setRequests(reqResult.data);
    if (bundleResult.success) setBundles(bundleResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!reqResult.success) setError(reqResult.error);
    else if (!bundleResult.success) setError(bundleResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Resource allocation health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedRequests = useMemo(() => (requests ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [requests]);

  return (
    <div>
      <PageHeader
        title="Resource Allocation"
        subtitle="Which combination of resources should perform the work — planning only. Resource Allocation never dispatches, reserves, or optimizes routes."
        icon={AssetsIcon}
        breadcrumb={[{ label: "Resource Allocation" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/allocations/bundles">
              <Button variant="secondary">Resource Bundles</Button>
            </Link>
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Resource Allocation isn't available" description={error} icon={AssetsIcon} /> : null}

      {requests && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Allocation Requests" value={String(requests.length)} icon={AssetsIcon} />
            <KpiCard label="Active Allocations" value={String(health.allocations.length)} icon={AssetsIcon} />
            <KpiCard label="Findings" value={String(health.findings.length)} icon={AnalyticsIcon} />
            <KpiCard label="Available Resources" value={String(health.resourcePool.availableCount)} icon={CheckIcon} />
          </div>

          <SectionHeader title="Overview" />
          <LuxuryCard tone="tint" className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Findings <span className="font-normal text-text-muted">({highFindings.length})</span>
            </h2>
            {highFindings.length === 0 ? <p className="text-sm text-success">No high-severity allocation findings.</p> : <ul role="list">{highFindings.map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </LuxuryCard>

          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Findings <span className="font-normal text-text-muted">({otherFindings.length})</span>
            </h2>
            {otherFindings.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherFindings.slice(0, 10).map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </LuxuryCard>

          <SectionHeader title="Allocation Requests" />
          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Allocation Requests <span className="font-normal text-text-muted">({sortedRequests.length})</span>
            </h2>
            {sortedRequests.length === 0 ? (
              <EmptyState title="No allocation requests yet" description="Allocation requests are created by the modules that need resources — an event, a client, or a project placeholder." icon={AssetsIcon} />
            ) : (
              <ul role="list">
                {sortedRequests.slice(0, 25).map((r) => (
                  <RequestRow key={r.id} request={r} />
                ))}
              </ul>
            )}
          </LuxuryCard>

          <SectionHeader title="Resource Pool & Bundles" />
          <div className="grid gap-6 md:grid-cols-2">
            <LuxuryCard>
              <h2 className="mb-3 text-sm font-semibold">Resource Pool</h2>
              <div className="grid grid-cols-2 gap-3">
                <PoolStat label="Available" value={health.resourcePool.availableCount} tone="success" />
                <PoolStat label="Reserved" value={health.resourcePool.reservedCount} tone="neutral" />
                <PoolStat label="Busy" value={health.resourcePool.busyCount} tone="warning" />
                <PoolStat label="Unavailable" value={health.resourcePool.unavailableCount} tone="danger" />
              </div>
              <p className="mt-3 text-xs text-text-muted">
                {health.resourcePool.sharedCount} shared resource{health.resourcePool.sharedCount === 1 ? "" : "s"} · {health.resourcePool.criticalCount} single point{health.resourcePool.criticalCount === 1 ? "" : "s"} of failure
              </p>
            </LuxuryCard>

            <LuxuryCard>
              <h2 className="mb-3 text-sm font-semibold">
                Resource Bundles <span className="font-normal text-text-muted">({bundles?.length ?? 0})</span>
              </h2>
              {!bundles || bundles.length === 0 ? (
                <p className="text-sm text-text-muted">No resource bundle templates yet.</p>
              ) : (
                <ul role="list">
                  {bundles.slice(0, 6).map((b) => (
                    <li key={b.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                      <span className="text-sm">{b.name}</span>
                      <span className="text-xs text-text-muted">{b.required_resources.length} required line{b.required_resources.length === 1 ? "" : "s"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/allocations/bundles" className="mt-3 inline-block">
                <Button variant="secondary">Manage Bundles</Button>
              </Link>
            </LuxuryCard>
          </div>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading resource allocation health…</p>
      ) : null}
    </div>
  );
}

function PoolStat({ label, value, tone }: { label: string; value: number; tone: BadgeTone }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-lg font-semibold">{value}</span>
        <Badge tone={tone}>{label}</Badge>
      </div>
    </div>
  );
}
