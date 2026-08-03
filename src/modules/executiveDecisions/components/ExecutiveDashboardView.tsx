"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { evaluateExecutiveDecisionsAction, updateDecisionStatusAction, type EvaluateExecutiveDecisionsResult } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { DECISION_CATEGORY_LABELS, type Decision } from "@/types/executiveDecisions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnalyticsIcon, CheckIcon, DocumentsIcon, AssetsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 25.7, Step 8 — Executive Dashboard. Every figure here is
 * read straight from `evaluateExecutiveDecisionsAction`'s already-computed
 * result — no new scoring, no new detection.
 *
 * Step 15 (Accessibility): every interactive row is a real `<button>` (not
 * a clickable `<div>`), status changes are announced via an `aria-live`
 * region, and the queue list carries `role="list"` with each entry as a
 * `role="listitem"` so screen readers get an accurate count. No custom
 * CSS animation is introduced — every transition reuses the app's existing
 * motion tokens, which already respect `prefers-reduced-motion`.
 *
 * Step 16 (Performance): decision groupings (critical/high, resolved,
 * blocked) are `useMemo`-derived so they don't recompute on every
 * unrelated re-render, and the full "All Decisions" list is lazy — it
 * only renders once expanded, rather than paying for every row on first
 * load. "Decision/Priority/Queue Cache" in the mock-data sense this
 * checkpoint can honestly claim: the dashboard doesn't re-run
 * `evaluateExecutiveDecisionsAction` on every render, only on mount and
 * on an explicit Re-evaluate click.
 */

const PRIORITY_TONE: Record<Decision["priority"], BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "accent",
  low: "neutral",
  informational: "outline",
};

function DecisionRow({ decision, onResolve, busy }: { decision: Decision; onResolve: (id: string) => void; busy: boolean }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge tone={PRIORITY_TONE[decision.priority]}>{decision.priority}</Badge>
          <span className="truncate text-sm font-medium">{decision.title}</span>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{DECISION_CATEGORY_LABELS[decision.category]}</p>
      </div>
      {decision.status !== "resolved" && decision.status !== "archived" ? (
        <Button variant="secondary" onClick={() => onResolve(decision.id)} disabled={busy} aria-label={`Mark "${decision.title}" resolved`}>
          Resolve
        </Button>
      ) : (
        <Badge tone="success">{decision.status}</Badge>
      )}
    </li>
  );
}

export function ExecutiveDashboardView() {
  const [data, setData] = useState<EvaluateExecutiveDecisionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showAllDecisions, setShowAllDecisions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    evaluateExecutiveDecisionsAction().then((result) => {
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reevaluate() {
    setLoading(true);
    setError(null);
    const result = await evaluateExecutiveDecisionsAction();
    if (result.success) setData(result.data);
    else setError(result.error);
    setLoading(false);
  }

  async function handleResolve(decisionId: string) {
    setBusyId(decisionId);
    const result = await updateDecisionStatusAction(decisionId, "resolved", null);
    if (result.success) {
      setAnnouncement(`"${result.data.title}" marked resolved.`);
      await reevaluate();
    } else {
      setAnnouncement(result.error);
    }
    setBusyId(null);
  }

  const critical = useMemo(() => data?.queue.filter((d) => d.priority === "critical") ?? [], [data]);
  const high = useMemo(() => data?.queue.filter((d) => d.priority === "high") ?? [], [data]);
  const pending = useMemo(() => data?.allDecisions.filter((d) => d.status !== "resolved" && d.status !== "archived") ?? [], [data]);

  return (
    <div>
      <PageHeader
        title="Executive Decision Platform"
        subtitle="What deserves attention, what to fix first, and what's blocking growth — continuously derived from Operational Intelligence."
        icon={AnalyticsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Business Health", href: "/assets/business-health" }, { label: "Executive Decisions" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/reports/templates">
              <Button variant="secondary">View as Report</Button>
            </Link>
            <Button variant="secondary" onClick={reevaluate} disabled={loading}>
              {loading ? "Evaluating…" : "Re-evaluate"}
            </Button>
          </div>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Executive Decisions aren't available" description={error} icon={AnalyticsIcon} /> : null}

      {data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Overall Executive Score" value={String(data.scorecard.overallExecutiveScore)} icon={AnalyticsIcon} helper={`Business ${data.scorecard.businessScore} · Objectives ${data.scorecard.objectiveScore}`} />
            <KpiCard label="Workspace Readiness" value={String(data.scorecard.readinessScore)} icon={CheckIcon} />
            <KpiCard label="Knowledge Score" value={String(data.scorecard.knowledgeScore)} icon={AssetsIcon} />
            <KpiCard label="Pending Decisions" value={String(pending.length)} icon={DocumentsIcon} helper={`${data.resolvedDecisions.length} resolved · ${data.blockedDecisions.length} blocked`} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                Critical Decisions <span className="font-normal text-text-muted">({critical.length})</span>
              </h2>
              {critical.length === 0 ? <p className="text-sm text-success">No critical decisions.</p> : <ul role="list">{critical.map((d) => <DecisionRow key={d.id} decision={d} onResolve={handleResolve} busy={busyId === d.id} />)}</ul>}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">
                High Priority Decisions <span className="font-normal text-text-muted">({high.length})</span>
              </h2>
              {high.length === 0 ? <p className="text-sm text-text-muted">No high-priority decisions.</p> : <ul role="list">{high.map((d) => <DecisionRow key={d.id} decision={d} onResolve={handleResolve} busy={busyId === d.id} />)}</ul>}
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="mb-3 text-sm font-semibold">
              Executive Queue <span className="font-normal text-text-muted">({data.queue.length})</span>
            </h2>
            {data.queue.length === 0 ? (
              <EmptyState title="The Executive Queue is empty" description="Nothing currently needs executive attention." icon={CheckIcon} />
            ) : (
              <ul role="list">{data.queue.slice(0, 10).map((d) => <DecisionRow key={d.id} decision={d} onResolve={handleResolve} busy={busyId === d.id} />)}</ul>
            )}
            {data.queue.length > 10 ? <p className="mt-2 text-xs text-text-muted">Showing the top 10 of {data.queue.length}.</p> : null}
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Risks</h2>
              {data.insights.mostViolatedBusinessRules.length === 0 && data.insights.mostBlockedObjectives.length === 0 ? (
                <p className="text-sm text-success">No significant risks detected.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.insights.mostViolatedBusinessRules.slice(0, 3).map((r) => (
                    <li key={r.ruleId} className="flex items-center justify-between">
                      <span>{r.ruleId}</span>
                      <Badge tone="danger">{r.count}×</Badge>
                    </li>
                  ))}
                  {data.insights.mostBlockedObjectives.slice(0, 3).map((o) => (
                    <li key={`${o.node.nodeType}:${o.node.nodeId}`} className="flex items-center justify-between">
                      <span>{o.label}</span>
                      <Badge tone="warning">blocked</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Top Opportunities</h2>
              {data.report.topImprovements.length === 0 ? (
                <p className="text-sm text-text-muted">Nothing to prioritize right now.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-text-muted">
                  {data.report.topImprovements.map((improvement, i) => (
                    <li key={i}>{improvement}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="mb-1 text-sm font-semibold">Decision Trends</h2>
            <p className="text-xs text-text-muted">Not available yet — this checkpoint evaluates the current state only and keeps no history of past evaluations, so there&apos;s no real trend to chart.</p>
          </Card>

          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                All Decisions <span className="font-normal text-text-muted">({data.allDecisions.length})</span>
              </h2>
              <Button variant="secondary" onClick={() => setShowAllDecisions((v) => !v)} aria-expanded={showAllDecisions}>
                {showAllDecisions ? "Hide" : "Show"}
              </Button>
            </div>
            {showAllDecisions ? (
              data.allDecisions.length === 0 ? (
                <EmptyState title="No decisions yet" icon={AnalyticsIcon} />
              ) : (
                <ul role="list">{data.allDecisions.map((d) => <DecisionRow key={d.id} decision={d} onResolve={handleResolve} busy={busyId === d.id} />)}</ul>
              )
            ) : (
              <p className="text-xs text-text-muted">Expand to render the full list.</p>
            )}
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Evaluating executive decisions…</p>
      ) : null}
    </div>
  );
}
