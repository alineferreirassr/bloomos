"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listExecutionPackagesAction, evaluateExecutionPackagePlatformHealthAction, type EvaluateExecutionPackagePlatformHealthResult } from "@/modules/executionPackage/executionPackageActions";
import type { ExecutionPackage, PackageFindingSeverity, PackageReadinessState } from "@/types/executionPackage";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InventoryIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.3, Step 14 — Execution Package Dashboard. Read-only,
 * same discipline `OperationalDashboardView.tsx`/`AllocationDashboardView.tsx`
 * established: every figure comes straight from
 * `evaluateExecutionPackagePlatformHealthAction`'s already-computed
 * result — no dispatch, no execution, no AI. Structural mutation actions
 * (`buildExecutionPackageAction`, `approveExecutionPackageAction`, etc.)
 * exist and are fully tested, but this view only reads and links through
 * to the Package Detail page — the same disclosed "no create/mutate
 * control wired yet" scope every prior platform dashboard in this
 * codebase carries.
 */
const SEVERITY_TONE: Record<PackageFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<PackageFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
const PACKAGE_STATUS_TONE: Record<ExecutionPackage["status"], BadgeTone> = { draft: "neutral", validated: "outline", approved: "success", archived: "neutral" };
const READINESS_TONE: Record<PackageReadinessState, BadgeTone> = {
  ready: "success",
  blocked: "danger",
  incomplete: "warning",
  waiting_approval: "warning",
  waiting_resources: "warning",
  waiting_schedule: "warning",
  waiting_dependencies: "warning",
  waiting_evidence: "warning",
};

function FindingRow({ description, severity }: { description: string; severity: PackageFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function PackageRow({ pkg, health, readinessState }: { pkg: ExecutionPackage; health: number | undefined; readinessState: PackageReadinessState | undefined }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{pkg.metadata.title}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {pkg.context.context_type.replace(/_/g, " ")} · {pkg.versions.length} version{pkg.versions.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {health !== undefined ? <span className="text-xs text-text-muted">Health {health}</span> : null}
        {readinessState ? <Badge tone={READINESS_TONE[readinessState]}>{readinessState.replace(/_/g, " ")}</Badge> : null}
        <Badge tone={PACKAGE_STATUS_TONE[pkg.status]}>{pkg.status}</Badge>
        <Link href={`/execution-packages/${pkg.id}`}>
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

export function ExecutionPackageDashboardView() {
  const [packages, setPackages] = useState<ExecutionPackage[] | null>(null);
  const [health, setHealth] = useState<EvaluateExecutionPackagePlatformHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listExecutionPackagesAction(), evaluateExecutionPackagePlatformHealthAction()]).then(([packagesResult, healthResult]) => {
      if (cancelled) return;
      if (packagesResult.success) setPackages(packagesResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!packagesResult.success) setError(packagesResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [packagesResult, healthResult] = await Promise.all([listExecutionPackagesAction(), evaluateExecutionPackagePlatformHealthAction()]);
    if (packagesResult.success) setPackages(packagesResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!packagesResult.success) setError(packagesResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Execution package health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedPackages = useMemo(() => (packages ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [packages]);
  const readyCount = useMemo(() => Object.values(health?.readinessByPackageId ?? {}).filter((r) => r.state === "ready").length, [health]);

  const averageHealth = useMemo(() => {
    const scores = Object.values(health?.healthByPackageId ?? {});
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s.overallPackageHealth, 0) / scores.length);
  }, [health]);

  return (
    <div>
      <PageHeader
        title="Execution Packages"
        subtitle="Everything required to perform planned work — one immutable, frozen bundle per package. Execution Packages never dispatch, execute, or capture evidence."
        icon={InventoryIcon}
        breadcrumb={[{ label: "Execution Packages" }]}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Execution Packages aren't available" description={error} icon={InventoryIcon} /> : null}

      {packages && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Execution Packages" value={String(packages.length)} icon={InventoryIcon} />
            <KpiCard label="Ready for Execution" value={String(readyCount)} icon={CheckIcon} />
            <KpiCard label="Findings" value={String(health.findings.length)} icon={AnalyticsIcon} />
            <KpiCard label="Average Package Health" value={averageHealth === null ? "—" : String(averageHealth)} icon={CheckIcon} />
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

          <SectionHeader title="Execution Packages" />
          <LuxuryCard>
            <h2 className="mb-3 text-sm font-semibold">
              Execution Packages <span className="font-normal text-text-muted">({sortedPackages.length})</span>
            </h2>
            {sortedPackages.length === 0 ? (
              <EmptyState title="No execution packages yet" description="Execution packages are built from an approved Operational Plan, Allocation, and Schedule through the module action layer." icon={InventoryIcon} />
            ) : (
              <ul role="list">
                {sortedPackages.slice(0, 25).map((p) => (
                  <PackageRow key={p.id} pkg={p} health={health.healthByPackageId[p.id]?.overallPackageHealth} readinessState={health.readinessByPackageId[p.id]?.state} />
                ))}
              </ul>
            )}
          </LuxuryCard>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading execution package health…</p>
      ) : null}
    </div>
  );
}
