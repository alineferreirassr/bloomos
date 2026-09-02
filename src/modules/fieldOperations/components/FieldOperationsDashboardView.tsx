"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listFieldOperationsAction, evaluateFieldOperationsPlatformHealthAction, type EvaluateFieldOperationsPlatformHealthResult } from "@/modules/fieldOperations/fieldOperationsActions";
import type { FieldOperation, ExecutionLifecycleState, FieldOperationFindingSeverity } from "@/types/fieldOperations";
import { EXECUTION_LIFECYCLE_STATES } from "@/types/fieldOperations";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 29, Step 12 — Field Operations Dashboard. Read-only,
 * the same discipline `DispatchDashboardView.tsx` established: every
 * figure comes straight from `evaluateFieldOperationsPlatformHealthAction`'s
 * already-computed results — no GPS, no live tracking, no route
 * optimization, no AI. Session lifecycle actions (start/pause/resume/
 * complete/cancel/abort/fail/archive) exist and are fully tested in
 * `fieldOperationsActions.ts`, but this view only reads and links
 * through to the Field Operation Detail page — the same disclosed
 * "no create/mutate control wired yet" scope every prior platform
 * dashboard in this codebase carries.
 */
const SEVERITY_TONE: Record<FieldOperationFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<FieldOperationFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
const LIFECYCLE_TONE: Record<ExecutionLifecycleState, BadgeTone> = {
  created: "neutral",
  waiting: "neutral",
  started: "outline",
  paused: "warning",
  resumed: "outline",
  completed: "success",
  cancelled: "danger",
  aborted: "danger",
  failed: "danger",
  archived: "neutral",
};
const OPERATION_STATUS_TONE: Record<FieldOperation["status"], BadgeTone> = { active: "outline", completed: "success", cancelled: "danger", archived: "neutral" };

function FindingRow({ description, severity }: { description: string; severity: FieldOperationFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function OperationRow({ operation, lifecycleState, health }: { operation: FieldOperation; lifecycleState: ExecutionLifecycleState | undefined; health: number | undefined }) {
  return (
    <li role="listitem" className="flex flex-col gap-2 border-b border-border/50 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between md:gap-3 md:py-2">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">Field Operation #{operation.id.slice(-8)}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {operation.priority} priority · {operation.sessions.length} session{operation.sessions.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {health !== undefined ? <span className="text-xs text-text-muted">Health {health}</span> : null}
        {lifecycleState ? <Badge tone={LIFECYCLE_TONE[lifecycleState]}>{lifecycleState}</Badge> : null}
        <Badge tone={OPERATION_STATUS_TONE[operation.status]}>{operation.status}</Badge>
        <Link href={`/field-operations/${operation.id}`} className="ml-auto md:ml-0">
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

export function FieldOperationsDashboardView() {
  const [operations, setOperations] = useState<FieldOperation[] | null>(null);
  const [health, setHealth] = useState<EvaluateFieldOperationsPlatformHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listFieldOperationsAction(), evaluateFieldOperationsPlatformHealthAction()]).then(([operationsResult, healthResult]) => {
      if (cancelled) return;
      if (operationsResult.success) setOperations(operationsResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!operationsResult.success) setError(operationsResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [operationsResult, healthResult] = await Promise.all([listFieldOperationsAction(), evaluateFieldOperationsPlatformHealthAction()]);
    if (operationsResult.success) setOperations(operationsResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!operationsResult.success) setError(operationsResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Field Operations health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedOperations = useMemo(() => (operations ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [operations]);

  const lifecycleByOperationId = useMemo(() => new Map((health?.results ?? []).map((r) => [r.fieldOperation.id, r.session.lifecycle_state] as const)), [health]);
  const healthByOperationId = useMemo(() => new Map((health?.results ?? []).map((r) => [r.fieldOperation.id, r.health.overallOperationalHealth] as const)), [health]);

  const activeCount = useMemo(() => (health?.results ?? []).filter((r) => r.session.lifecycle_state === "started" || r.session.lifecycle_state === "resumed").length, [health]);
  const pausedCount = useMemo(() => (health?.results ?? []).filter((r) => r.session.lifecycle_state === "paused").length, [health]);
  const completedCount = useMemo(() => (health?.results ?? []).filter((r) => r.session.outcome === "completed").length, [health]);
  const blockedOperations = useMemo(() => (health?.results ?? []).filter((r) => !r.validation.valid), [health]);

  const lifecycleDistribution = useMemo(() => {
    const counts = new Map<ExecutionLifecycleState, number>();
    for (const state of EXECUTION_LIFECYCLE_STATES) counts.set(state, 0);
    for (const r of health?.results ?? []) counts.set(r.session.lifecycle_state, (counts.get(r.session.lifecycle_state) ?? 0) + 1);
    return EXECUTION_LIFECYCLE_STATES.map((state) => ({ state, count: counts.get(state) ?? 0 })).filter((entry) => entry.count > 0);
  }, [health]);

  const averageHealth = useMemo(() => {
    const scores = (health?.results ?? []).map((r) => r.health.overallOperationalHealth);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }, [health]);

  return (
    <div>
      <PageHeader
        title="Field Operations"
        subtitle="Manages execution state for work Dispatch has already assigned — no GPS, no live tracking, no route optimization, no AI."
        icon={VendorsIcon}
        breadcrumb={[{ label: "Field Operations" }]}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Field Operations aren't available" description={error} icon={VendorsIcon} /> : null}

      {operations && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Active Sessions" value={String(activeCount)} icon={VendorsIcon} />
            <KpiCard label="Paused Sessions" value={String(pausedCount)} icon={CheckIcon} />
            <KpiCard label="Completed Sessions" value={String(completedCount)} icon={CheckIcon} />
            <KpiCard label="Average Operational Health" value={averageHealth === null ? "—" : String(averageHealth)} icon={AnalyticsIcon} />
          </div>

          <SectionHeader title="Operational Status" />
          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Blocked Operations <span className="font-normal text-text-muted">({blockedOperations.length})</span>
            </h2>
            {blockedOperations.length === 0 ? (
              <p className="text-sm text-success">No operations are currently blocked.</p>
            ) : (
              <ul role="list">
                {blockedOperations.slice(0, 10).map((r) => (
                  <li key={r.fieldOperation.id} role="listitem" className="flex flex-col gap-2 border-b border-border/50 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between md:gap-3 md:py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">Field Operation #{r.fieldOperation.id.slice(-8)}</span>
                      <p className="mt-0.5 text-xs text-text-muted">{r.validation.errors[0]?.detail ?? "Blocked"}</p>
                    </div>
                    <Link href={`/field-operations/${r.fieldOperation.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">Lifecycle Distribution</h2>
            {lifecycleDistribution.length === 0 ? (
              <p className="text-sm text-text-muted">No sessions yet.</p>
            ) : (
              <ul role="list" className="flex flex-wrap gap-2">
                {lifecycleDistribution.map(({ state, count }) => (
                  <li key={state} role="listitem">
                    <Badge tone={LIFECYCLE_TONE[state]}>
                      {state} · {count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

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

          <SectionHeader title="Operations Queue" />
          <LuxuryCard>
            <h2 className="mb-3 text-sm font-semibold">
              Field Operations <span className="font-normal text-text-muted">({sortedOperations.length})</span>
            </h2>
            {sortedOperations.length === 0 ? (
              <EmptyState title="No field operations yet" description="Field Operations are built from an accepted Dispatch Assignment through the module action layer." icon={VendorsIcon} />
            ) : (
              <ul role="list">
                {sortedOperations.slice(0, 25).map((o) => (
                  <OperationRow key={o.id} operation={o} lifecycleState={lifecycleByOperationId.get(o.id)} health={healthByOperationId.get(o.id)} />
                ))}
              </ul>
            )}
          </LuxuryCard>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading field operations health…</p>
      ) : null}
    </div>
  );
}
