"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listOperationalPlansAction, listPlanTemplatesAction, evaluateOperationalPlanningHealthAction, type EvaluateOperationalPlanningHealthResult } from "@/modules/operationalPlanning/operationalPlanningActions";
import type { OperationalPlan, PlanTemplate, OperationalFindingSeverity } from "@/types/operationalPlanning";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentTemplatesIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.2, Step 19 — Operational Dashboard. Read-only, same
 * discipline `AllocationDashboardView.tsx`/`CalendarDashboardView.tsx`
 * established: every figure comes straight from
 * `evaluateOperationalPlanningHealthAction`'s already-computed result —
 * no execution, no evidence capture, no AI. Structural mutation actions
 * (`addPhaseAction`, `approvePlanAction`, etc.) exist and are fully
 * tested in `operationalPlanningActions.ts`, but — matching the same
 * disclosed "no create/mutate control wired into the dashboard yet"
 * scope every prior platform dashboard in this codebase carries — this
 * view only reads and links through to the Plan Detail page.
 */
const SEVERITY_TONE: Record<OperationalFindingSeverity, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };
const SEVERITY_LABEL: Record<OperationalFindingSeverity, string> = { high: "High", medium: "Medium", low: "Low" };
const PLAN_STATUS_TONE: Record<OperationalPlan["status"], BadgeTone> = { draft: "neutral", active: "accent", approved: "success", completed: "success", archived: "outline" };

function FindingRow({ description, severity }: { description: string; severity: OperationalFindingSeverity }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
    </li>
  );
}

function PlanRow({ plan, health }: { plan: OperationalPlan; health: number | undefined }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{plan.name}</span>
        <p className="mt-0.5 text-xs text-text-muted">
          {plan.context_type.replace(/_/g, " ")} · {plan.phases.length} phase{plan.phases.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {health !== undefined ? <span className="text-xs text-text-muted">Health {health}</span> : null}
        <Badge tone={PLAN_STATUS_TONE[plan.status]}>{plan.status}</Badge>
        <Link href={`/operational-planning/plans/${plan.id}`}>
          <Button variant="secondary">View</Button>
        </Link>
      </div>
    </li>
  );
}

export function OperationalDashboardView() {
  const [plans, setPlans] = useState<OperationalPlan[] | null>(null);
  const [templates, setTemplates] = useState<PlanTemplate[] | null>(null);
  const [health, setHealth] = useState<EvaluateOperationalPlanningHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOperationalPlansAction(), listPlanTemplatesAction(), evaluateOperationalPlanningHealthAction()]).then(([plansResult, templatesResult, healthResult]) => {
      if (cancelled) return;
      if (plansResult.success) setPlans(plansResult.data);
      if (templatesResult.success) setTemplates(templatesResult.data);
      if (healthResult.success) setHealth(healthResult.data);

      if (!plansResult.success) setError(plansResult.error);
      else if (!templatesResult.success) setError(templatesResult.error);
      else if (!healthResult.success) setError(healthResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    const [plansResult, templatesResult, healthResult] = await Promise.all([listOperationalPlansAction(), listPlanTemplatesAction(), evaluateOperationalPlanningHealthAction()]);
    if (plansResult.success) setPlans(plansResult.data);
    if (templatesResult.success) setTemplates(templatesResult.data);
    if (healthResult.success) setHealth(healthResult.data);

    if (!plansResult.success) setError(plansResult.error);
    else if (!templatesResult.success) setError(templatesResult.error);
    else if (!healthResult.success) setError(healthResult.error);
    else setError(null);

    setAnnouncement("Operational planning health refreshed.");
    setLoading(false);
  }

  const highFindings = useMemo(() => health?.findings.filter((f) => f.severity === "high") ?? [], [health]);
  const otherFindings = useMemo(() => health?.findings.filter((f) => f.severity !== "high") ?? [], [health]);
  const sortedPlans = useMemo(() => (plans ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)), [plans]);

  const averageHealth = useMemo(() => {
    const scores = Object.values(health?.healthByPlanId ?? {});
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((sum, s) => sum + s.overallOperationalHealth, 0) / scores.length);
  }, [health]);

  return (
    <div>
      <PageHeader
        title="Operational Planning"
        subtitle="How this operation should be executed — phases, steps, dependencies, milestones, deliverables, evidence, checklists, and approvals. Operational Planning never dispatches, executes, or captures evidence."
        icon={DocumentTemplatesIcon}
        breadcrumb={[{ label: "Operational Planning" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/operational-planning/templates">
              <Button variant="secondary">Plan Templates</Button>
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

      {error ? <EmptyState title="Operational Planning isn't available" description={error} icon={DocumentTemplatesIcon} /> : null}

      {plans && health ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Operational Plans" value={String(plans.length)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Plan Templates" value={String(templates?.length ?? 0)} icon={DocumentTemplatesIcon} />
            <KpiCard label="Findings" value={String(health.findings.length)} icon={AnalyticsIcon} />
            <KpiCard label="Average Operational Health" value={averageHealth === null ? "—" : String(averageHealth)} icon={CheckIcon} />
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Findings <span className="font-normal text-text-muted">({highFindings.length})</span>
            </h2>
            {highFindings.length === 0 ? <p className="text-sm text-success">No high-severity operational findings.</p> : <ul role="list">{highFindings.map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Findings <span className="font-normal text-text-muted">({otherFindings.length})</span>
            </h2>
            {otherFindings.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherFindings.slice(0, 10).map((f) => <FindingRow key={f.id} description={f.description} severity={f.severity} />)}</ul>}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Operational Plans <span className="font-normal text-text-muted">({sortedPlans.length})</span>
            </h2>
            {sortedPlans.length === 0 ? (
              <EmptyState title="No operational plans yet" description="Operational plans are created from a plan template, or from scratch, through the module action layer." icon={DocumentTemplatesIcon} />
            ) : (
              <ul role="list">
                {sortedPlans.slice(0, 25).map((p) => (
                  <PlanRow key={p.id} plan={p} health={health.healthByPlanId[p.id]?.overallOperationalHealth} />
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Loading operational planning health…</p>
      ) : null}
    </div>
  );
}
