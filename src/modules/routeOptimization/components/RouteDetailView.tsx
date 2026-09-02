"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRoutePlanAction, evaluateRoutePlanAction } from "@/modules/routeOptimization/routeOptimizationActions";
import type { RoutePlan, RoutePlanStatus, Route } from "@/types/routeOptimization";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 30, Step 13 — Route Detail. One route plan's full
 * picture: its waypoints, segments, declared constraints, and — on
 * demand — its travel estimate, optimization, health scores, and
 * explanation. `evaluateRoutePlanAction` is wired directly into this
 * read-only view — the same deliberate exception
 * `FieldOperationDetailView.tsx`'s `evaluateFieldOperationAction`
 * establishes: a genuine re-derivation of already-computed data, never
 * a mutation. Optimize/validate/approve/archive actions exist and are
 * fully tested in `routeOptimizationActions.ts`, but this view only
 * reads — the same disclosed "no create/mutate control wired yet" scope
 * every prior platform detail view in this codebase carries.
 *
 * The "Timeline" section renders the plan's own `versions:
 * RouteVersion[]` — each new version corresponds 1:1 to the
 * "Route Optimized"/"Optimization Recalculated" Timeline events those
 * transitions are emitted from, rather than duplicating the global
 * Timeline feed those events are already recorded into.
 */
const STATUS_TONE: Record<RoutePlanStatus, BadgeTone> = { draft: "neutral", validated: "outline", approved: "success", archived: "neutral" };

export function RouteDetailView({ routePlanId }: { routePlanId: string }) {
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Route | "loading" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRoutePlanAction(routePlanId).then((routePlanResult) => {
      if (cancelled) return;
      if (routePlanResult.success) setRoutePlan(routePlanResult.data);
      else setError(routePlanResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [routePlanId]);

  async function evaluate() {
    setResult("loading");
    const evalResult = await evaluateRoutePlanAction(routePlanId);
    setResult(evalResult.success ? evalResult.data : null);
  }

  if (error) return <EmptyState title="This route plan isn't available" description={error} icon={VendorsIcon} />;
  if (!routePlan) return <p className="text-sm text-text-muted">Loading route plan…</p>;

  const currentVersion = routePlan.versions[routePlan.versions.length - 1];
  const snapshot = currentVersion.snapshot;
  const sortedVersions = routePlan.versions.slice().sort((a, b) => b.version_number - a.version_number);

  return (
    <div>
      <PageHeader
        title={`Route Plan #${routePlan.id.slice(-8)}`}
        subtitle={`${routePlan.priority} priority · ${routePlan.versions.length} version${routePlan.versions.length === 1 ? "" : "s"} · created ${new Date(routePlan.created_at).toLocaleString()}`}
        icon={VendorsIcon}
        breadcrumb={[{ label: "Route Optimization", href: "/route-optimization" }, { label: `Route Plan #${routePlan.id.slice(-8)}` }]}
        actions={<Badge tone={STATUS_TONE[routePlan.status]}>{routePlan.status}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Waypoints" value={String(snapshot.waypoints.length)} icon={VendorsIcon} />
        <KpiCard label="Segments" value={String(snapshot.segments.length)} icon={CheckIcon} />
        <KpiCard label="Constraints" value={String(snapshot.constraints.length)} icon={CheckIcon} />
        <KpiCard label="Versions" value={String(routePlan.versions.length)} icon={CheckIcon} />
      </div>

      <SectionHeader title="Evaluation" />

      <LuxuryCard tone="tint" className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Evaluation</h2>
          <Button variant="secondary" onClick={evaluate} disabled={result === "loading"}>
            {result === "loading" ? "Evaluating…" : "Evaluate"}
          </Button>
        </div>
        {result && result !== "loading" ? (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted">Travel Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.travelHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Efficiency Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.efficiencyHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Delay Risk</p>
                <p className="text-lg font-semibold">{Math.round(result.health.delayRisk)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Constraint Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.constraintHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Optimization Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.optimizationHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Overall</p>
                <p className="text-lg font-semibold">{Math.round(result.health.overallRouteHealth)}</p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-text-muted">Travel Time</p>
                <p className="text-sm font-medium">{result.travelEstimate.estimatedTravelMinutes}m</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Distance</p>
                <p className="text-sm font-medium">{result.travelEstimate.estimatedDistanceKm}km</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Idle Time</p>
                <p className="text-sm font-medium">{result.travelEstimate.estimatedIdleMinutes}m</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Total Duration</p>
                <p className="text-sm font-medium">{result.travelEstimate.estimatedTotalDurationMinutes}m</p>
              </div>
            </div>

            <p className="mb-1 text-sm">{result.explanation.summary}</p>
            <p className="mb-3 text-xs text-text-muted">{result.explanation.optimizationScoreSummary}</p>

            {result.explanation.optimizationDecisions.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Optimization decisions</p>
                <ul role="list">
                  {result.explanation.optimizationDecisions.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.explanation.rejectedRouteReasons.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Why this route was rejected</p>
                <ul role="list">
                  {result.explanation.rejectedRouteReasons.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.explanation.constraintViolations.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Constraint violations</p>
                <ul role="list">
                  {result.explanation.constraintViolations.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.validation.errors.length > 0 ? (
              <ul role="list" className="mb-2">
                {result.validation.errors.map((e, i) => (
                  <li key={i} role="listitem" className="flex items-center gap-2 py-1 text-xs">
                    <Badge tone="danger">{e.rule.replace(/_/g, " ")}</Badge>
                    <span className="text-text-muted">{e.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-text-muted">Run an evaluation to see travel estimates, health scores, and an explanation.</p>
        )}
      </LuxuryCard>

      <SectionHeader title="Route Structure" />

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Waypoints <span className="font-normal text-text-muted">({snapshot.waypoints.length})</span>
        </h2>
        {snapshot.waypoints.length === 0 ? (
          <p className="text-sm text-text-muted">No waypoints on this route.</p>
        ) : (
          <ul role="list">
            {snapshot.waypoints
              .slice()
              .sort((a, b) => a.sequence_index - b.sequence_index)
              .map((wp) => (
                <li key={wp.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">
                    {wp.sequence_index + 1}. {wp.label}
                  </span>
                  <Badge tone="neutral">{wp.kind.replace(/_/g, " ")}</Badge>
                </li>
              ))}
          </ul>
        )}
      </LuxuryCard>

      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Constraints <span className="font-normal text-text-muted">({snapshot.constraints.length})</span>
        </h2>
        {snapshot.constraints.length === 0 ? (
          <p className="text-sm text-text-muted">No constraints declared on this route.</p>
        ) : (
          <ul role="list">
            {snapshot.constraints.map((c) => (
              <li key={c.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{c.kind.replace(/_/g, " ")}</span>
                  {c.description ? <p className="mt-0.5 text-xs text-text-muted">{c.description}</p> : null}
                </div>
                <span className="text-xs text-text-muted">{String(c.limit_value)}</span>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>

      <SectionHeader title="Version Timeline" />

      <LuxuryCard>
        <h2 className="mb-3 text-sm font-semibold">
          Timeline <span className="font-normal text-text-muted">({sortedVersions.length} version{sortedVersions.length === 1 ? "" : "s"})</span>
        </h2>
        <ul role="list">
          {sortedVersions.map((v) => (
            <li key={v.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">Version {v.version_number}</span>
                {v.snapshot.optimization_result ? <span className="ml-2 text-xs text-text-muted">Optimization score {v.snapshot.optimization_result.optimizationScore}</span> : <span className="ml-2 text-xs text-text-muted">Not optimized</span>}
              </div>
              <span className="text-xs text-text-muted">{new Date(v.created_at).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </LuxuryCard>

      <Link href="/route-optimization" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Route Optimization
      </Link>
    </div>
  );
}
