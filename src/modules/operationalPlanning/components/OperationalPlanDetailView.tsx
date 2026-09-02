"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOperationalPlanAction, evaluateOperationalPlanAction } from "@/modules/operationalPlanning/operationalPlanningActions";
import type { OperationalPlan, OperationalPlanResult, ExecutionStep } from "@/types/operationalPlanning";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentTemplatesIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.2, Step 20 — Operational Plan Detail. One plan's full
 * structure: phases with their steps and dependencies, milestones,
 * deliverables, evidence requirements, checklists, and approvals.
 * `evaluateOperationalPlanAction` re-derives already-computed
 * validation/health/explanation/critical-path data — a read, not a
 * mutation — so it's wired directly, matching the same exception
 * `AllocationRequestDetailView.tsx`'s `reEvaluateAllocationAction` and
 * `compareAllocationProposalsAction` established. Structural mutations
 * (`addPhaseAction`, `approvePlanAction`, `decideApprovalAction`, etc.)
 * stay unwired, matching every prior platform detail view's disclosed
 * "no create/mutate form yet" scope.
 */
const PLAN_STATUS_TONE: Record<OperationalPlan["status"], BadgeTone> = { draft: "neutral", active: "outline", approved: "success", completed: "success", archived: "neutral" };
const STEP_STATUS_TONE: Record<ExecutionStep["status"], BadgeTone> = { pending: "neutral", in_progress: "outline", completed: "success", skipped: "neutral", blocked: "danger" };

function ScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold">{Math.round(value)}</p>
    </div>
  );
}

export function OperationalPlanDetailView({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<OperationalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OperationalPlanResult | "loading" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOperationalPlanAction(planId).then((planResult) => {
      if (cancelled) return;
      if (planResult.success) setPlan(planResult.data);
      else setError(planResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  async function evaluate() {
    setResult("loading");
    const evalResult = await evaluateOperationalPlanAction(planId);
    setResult(evalResult.success ? evalResult.data : null);
  }

  const sortedPhases = useMemo(() => (plan?.phases ?? []).slice().sort((a, b) => a.order - b.order), [plan]);
  const totalSteps = useMemo(() => sortedPhases.reduce((sum, p) => sum + p.steps.length, 0), [sortedPhases]);

  if (error) return <EmptyState title="This operational plan isn't available" description={error} icon={DocumentTemplatesIcon} />;
  if (!plan) return <p className="text-sm text-text-muted">Loading operational plan…</p>;

  return (
    <div>
      <PageHeader
        title={plan.name}
        subtitle={`${plan.context_type.replace(/_/g, " ")} · version ${plan.version} · ${sortedPhases.length} phase${sortedPhases.length === 1 ? "" : "s"}, ${totalSteps} step${totalSteps === 1 ? "" : "s"}`}
        icon={DocumentTemplatesIcon}
        breadcrumb={[{ label: "Operational Planning", href: "/operational-planning" }, { label: plan.name }]}
        actions={<Badge tone={PLAN_STATUS_TONE[plan.status]}>{plan.status}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Phases" value={String(sortedPhases.length)} icon={DocumentTemplatesIcon} />
        <KpiCard label="Steps" value={String(totalSteps)} icon={DocumentTemplatesIcon} />
        <KpiCard label="Milestones" value={String(plan.milestones.length)} icon={CheckIcon} />
        <KpiCard label="Approvals" value={String(plan.approvals.length)} icon={CheckIcon} />
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
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <ScoreItem label="Completeness" value={result.health.planCompletenessScore} />
              <ScoreItem label="Dependency Health" value={result.health.dependencyHealthScore} />
              <ScoreItem label="Evidence Coverage" value={result.health.evidenceCoverageScore} />
              <ScoreItem label="Overall Health" value={result.health.overallOperationalHealth} />
            </div>
            <p className="mb-2 text-sm">{result.explanation.summary}</p>
            <p className="mb-3 text-xs text-text-muted">{result.explanation.criticalPathSummary}</p>
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
            {result.validation.warnings.length > 0 ? (
              <ul role="list">
                {result.validation.warnings.map((w, i) => (
                  <li key={i} role="listitem" className="flex items-center gap-2 py-1 text-xs">
                    <Badge tone="warning">{w.rule.replace(/_/g, " ")}</Badge>
                    <span className="text-text-muted">{w.detail}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-text-muted">Run an evaluation to see validation, health scores, and the critical path.</p>
        )}
      </LuxuryCard>

      <SectionHeader title="Phases & Steps" />
      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Phases <span className="font-normal text-text-muted">({sortedPhases.length})</span>
        </h2>
        {sortedPhases.length === 0 ? (
          <p className="text-sm text-text-muted">No phases yet.</p>
        ) : (
          sortedPhases.map((phase) => (
            <div key={phase.id} className="mb-4 border-b border-border/50 pb-4 last:border-b-0 last:pb-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{phase.name}</h3>
                <Badge tone="neutral">{phase.kind.replace(/_/g, " ")}</Badge>
              </div>
              {phase.steps.length === 0 ? (
                <p className="text-xs text-text-muted">No steps in this phase.</p>
              ) : (
                <ul role="list">
                  {phase.steps.map((step) => (
                    <li key={step.id} role="listitem" className="flex items-center justify-between gap-3 border-t border-border/30 py-2 first:border-t-0">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm">{step.title}</span>
                        {step.dependencies.length > 0 ? <p className="mt-0.5 text-xs text-text-muted">{step.dependencies.length} dependenc{step.dependencies.length === 1 ? "y" : "ies"}</p> : null}
                      </div>
                      <span className="text-xs text-text-muted">{step.estimated_duration_minutes}m</span>
                      <Badge tone={STEP_STATUS_TONE[step.status]}>{step.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </LuxuryCard>

      <SectionHeader title="Requirements & Approvals" />
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">
            Milestones <span className="font-normal text-text-muted">({plan.milestones.length})</span>
          </h2>
          {plan.milestones.length === 0 ? (
            <p className="text-sm text-text-muted">No milestones yet.</p>
          ) : (
            <ul role="list">
              {plan.milestones.map((m) => (
                <li key={m.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{m.title}</span>
                  <Badge tone={m.status === "completed" ? "success" : m.status === "blocked" ? "danger" : "neutral"}>{m.status.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">
            Deliverables <span className="font-normal text-text-muted">({plan.deliverables.length})</span>
          </h2>
          {plan.deliverables.length === 0 ? (
            <p className="text-sm text-text-muted">No deliverables yet.</p>
          ) : (
            <ul role="list">
              {plan.deliverables.map((d) => (
                <li key={d.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{d.title}</span>
                  <Badge tone={d.status === "delivered" ? "success" : d.status === "rejected" ? "danger" : "neutral"}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">
            Evidence Requirements <span className="font-normal text-text-muted">({plan.evidence_requirements.length})</span>
          </h2>
          {plan.evidence_requirements.length === 0 ? (
            <p className="text-sm text-text-muted">No evidence requirements yet.</p>
          ) : (
            <ul role="list">
              {plan.evidence_requirements.map((e) => (
                <li key={e.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{e.description}</span>
                  <Badge tone="neutral">{e.type.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">
            Approvals <span className="font-normal text-text-muted">({plan.approvals.length})</span>
          </h2>
          {plan.approvals.length === 0 ? (
            <p className="text-sm text-text-muted">No approval requirements yet.</p>
          ) : (
            <ul role="list">
              {plan.approvals.map((a) => (
                <li key={a.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{a.description}</span>
                  <Badge tone={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
      </div>

      {plan.checklists.length > 0 ? (
        <>
          <SectionHeader title="Checklists" />
          <LuxuryCard className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Checklists <span className="font-normal text-text-muted">({plan.checklists.length})</span>
            </h2>
          {plan.checklists.map((c) => {
            const completedCount = c.items.filter((i) => i.completed).length;
            return (
              <div key={c.id} className="mb-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{c.name}</p>
                  <span className="text-xs text-text-muted">
                    {completedCount}/{c.items.length}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{c.kind.replace(/_/g, " ")}</p>
              </div>
            );
          })}
          </LuxuryCard>
        </>
      ) : null}

      <Link href="/operational-planning" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Operational Planning
      </Link>
    </div>
  );
}
