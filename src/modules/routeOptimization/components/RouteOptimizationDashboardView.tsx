"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listRoutePlansAction, evaluateRouteOptimizationPlatformHealthAction, type EvaluateRouteOptimizationPlatformHealthResult } from "@/modules/routeOptimization/routeOptimizationActions";
import type { RoutePlan, RoutePlanStatus, RouteFindingSeverity } from "@/types/routeOptimization";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 30, Step 11 — Route Optimization Dashboard. Read-only,
 * the same discipline `FieldOperationsDashboardView.tsx` established:
 * every figure comes straight from
 * `evaluateRouteOptimizationPlatformHealthAction`'s already-computed
 * results — no GPS, no live tracking, no external map/traffic provider,
 * no AI. Build/optimize/validate/approve/archive actions exist and are
 * fully tested in `routeOptimizationActions.ts`, but this view only
 * reads and links through to the Route Detail page — the same disclosed
 * "no create/mutate control wired yet" scope every prior platform
 * dashboard in this codebase carries.
 */
const SEVERITY_TONE: Record<RouteFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<RouteFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
const STATUS_TONE: Record<RoutePlanStatus, BadgeTone> = { draft: "neutral", validated: "accent", approved: "success", archived: "outline" };

function FindingRow({ description, severity }: { description: string; severity: RouteFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function RoutePlanRow({ routePlan, optimizationScore, health }: { routePlan: RoutePlan; optimizationScore: number | undefined; health: number | undefined }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">Route Plan #{routePlan.id.slice(-8)}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {routePlan.priority} priority · {routePlan.versions.length} version{routePlan.versions.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {optimizationScore !== undefined ? <span className="text-xs text-text-muted">Score {optimizationScore}</span> : null}
        {health !== undefined ? <span className="text-xs text-text-muted">Health {health}</span> : null}
        <Badge tone={STATUS_TONE[routePlan.status]}>{routePlan.status}</Badge>
        <Link href={`/route-optimization/${routePlan.id}`}>
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

export function RouteOptimizationDashboardView() {
  const [routePlans, setRoutePlans] = useState<RoutePlan[] | null>(null);
  const [health, setHealth] = useState<EvaluateRouteOptimizationPlatformHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listRoutePlansAction(), evaluateRouteOptimizationPlatformHealthAction()]).then(([routePlansResult, healthResult]) => {
      if (cancelled) return;
      if (routePlansResult.success) setRoutePlans(routePlansResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!routePlansResult.success) setError(routePlansResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [routePlansResult, healthResult] = await Promise.all([listRoutePlansAction(), evaluateRouteOptimizationPlatformHealthAction()]);
    if (routePlansResult.success) setRoutePlans(routePlansResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!routePlansResult.success) setError(routePlansResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Route Optimization health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedRoutePlans = useMemo(() => (routePlans ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [routePlans]);

  const optimizationScoreByPlanId = useMemo(() => new Map((health?.results ?? []).map((r) => [r.routePlan.id, r.optimization?.optimizationScore] as const).filter((entry): entry is [string, number] => entry[1] !== undefined)), [health]);
  const healthByPlanId = useMemo(() => new Map((health?.results ?? []).map((r) => [r.routePlan.id, r.health.overallRouteHealth] as const)), [health]);

  const constraintViolations = useMemo(() => (health?.results ?? []).filter((r) => r.health.constraintHealth < 100), [health]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<RoutePlanStatus, number>();
    for (const p of routePlans ?? []) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [routePlans]);

  const averageOptimizationScore = useMemo(() => {
    const scores = (health?.results ?? []).map((r) => r.optimization?.optimizationScore).filter((s): s is number => s !== undefined);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [health]);

  const averageRouteHealth = useMemo(() => {
    const scores = (health?.results ?? []).map((r) => r.health.overallRouteHealth);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [health]);

  return (
    <div>
      <PageHeader
        title="Route Optimization"
        subtitle="Calculates and manages routes for work Dispatch has already assigned — no GPS, no external map providers, no AI."
        icon={VendorsIcon}
        breadcrumb={[{ label: "Route Optimization" }]}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Route Optimization isn't available" description={error} icon={VendorsIcon} /> : null}

      {routePlans && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Route Plans" value={String(routePlans.length)} icon={VendorsIcon} />
            <KpiCard label="Average Optimization Score" value={averageOptimizationScore === null ? "—" : String(averageOptimizationScore)} icon={CheckIcon} />
            <KpiCard label="Findings" value={String(health.findings.length)} icon={AnalyticsIcon} />
            <KpiCard label="Average Route Health" value={averageRouteHealth === null ? "—" : String(averageRouteHealth)} icon={CheckIcon} />
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Constraint Violations <span className="font-normal text-text-muted">({constraintViolations.length})</span>
            </h2>
            {constraintViolations.length === 0 ? (
              <p className="text-sm text-success">No routes currently violate a declared constraint.</p>
            ) : (
              <ul role="list">
                {constraintViolations.slice(0, 10).map((r) => (
                  <li key={r.routePlan.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <span className="text-sm">Route Plan #{r.routePlan.id.slice(-8)}</span>
                    <span className="text-xs text-text-muted">Constraint health {r.health.constraintHealth}/100</span>
                    <Link href={`/route-optimization/${r.routePlan.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">Status Distribution</h2>
            {statusDistribution.length === 0 ? (
              <p className="text-sm text-text-muted">No route plans yet.</p>
            ) : (
              <ul role="list" className="flex flex-wrap gap-2">
                {statusDistribution.map(({ status, count }) => (
                  <li key={status} role="listitem">
                    <Badge tone={STATUS_TONE[status]}>
                      {status} · {count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Findings <span className="font-normal text-text-muted">({highFindings.length})</span>
            </h2>
            {highFindings.length === 0 ? <p className="text-sm text-success">No high-severity findings.</p> : <ul role="list">{highFindings.map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Findings <span className="font-normal text-text-muted">({otherFindings.length})</span>
            </h2>
            {otherFindings.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherFindings.slice(0, 10).map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Route Plans <span className="font-normal text-text-muted">({sortedRoutePlans.length})</span>
            </h2>
            {sortedRoutePlans.length === 0 ? (
              <EmptyState title="No route plans yet" description="Route plans are built from an accepted Dispatch Assignment through the module action layer." icon={VendorsIcon} />
            ) : (
              <ul role="list">
                {sortedRoutePlans.slice(0, 25).map((p) => (
                  <RoutePlanRow key={p.id} routePlan={p} optimizationScore={optimizationScoreByPlanId.get(p.id)} health={healthByPlanId.get(p.id)} />
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading route optimization health…</p>
      ) : null}
    </div>
  );
}
