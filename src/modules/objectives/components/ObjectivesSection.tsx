"use client";

import { useEffect, useState } from "react";
import { evaluateObjectivesAction, type EvaluateObjectivesResult } from "@/modules/objectives/objectivesActions";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnalyticsIcon, CheckIcon, DocumentsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 25, Step 15.6 — extends the Business Health Dashboard
 * (`BusinessHealthDashboardView.tsx`) with Objectives Overview, Progress
 * Indicators, Blocked Objectives, and Upcoming Objectives. "Objective
 * Completion Trend" is deliberately absent: this checkpoint has no
 * historical scorecard storage (`businessHealthSnapshotsStore.ts` keeps
 * only the latest evaluation, not a time series), so a trend chart here
 * would have to fabricate data points — disclosed below instead, same
 * "notApplicableReason" honesty as every other engine this checkpoint.
 */

const HEALTH_TONE: Record<string, BadgeTone> = {
  on_track: "success",
  at_risk: "warning",
  off_track: "danger",
  blocked: "danger",
};

function daysUntil(dueDate: string, now: string): number {
  return Math.ceil((new Date(dueDate).getTime() - new Date(now).getTime()) / (24 * 60 * 60 * 1000));
}

export function ObjectivesSection() {
  const [data, setData] = useState<EvaluateObjectivesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    evaluateObjectivesAction().then((result) => {
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <EmptyState title="Objectives aren't available" description={error} icon={AnalyticsIcon} />;
  if (!data) return <p className="text-sm text-text-muted">Evaluating objectives…</p>;

  const { evaluations, scorecard } = data;
  const blocked = evaluations.filter((e) => e.health.state === "blocked");
  const upcoming = evaluations
    .filter((e) => e.objective.due_date !== null && e.objective.status !== "completed" && e.objective.status !== "archived")
    .sort((a, b) => new Date(a.objective.due_date as string).getTime() - new Date(b.objective.due_date as string).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Objectives Overview</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Objectives Completed" value={String(scorecard.objectivesCompleted)} icon={CheckIcon} />
          <KpiCard label="Objectives Blocked" value={String(scorecard.objectivesBlocked)} icon={AnalyticsIcon} />
          <KpiCard label="Objectives Overdue" value={String(scorecard.objectivesOverdue)} icon={DocumentsIcon} />
          <KpiCard label="Overall Operational Score" value={String(scorecard.overallOperationalScore)} icon={AnalyticsIcon} helper={`Avg. completion ${scorecard.averageCompletion}% · Business readiness ${scorecard.businessReadiness}`} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Progress Indicators <span className="font-normal text-text-muted">({evaluations.length})</span>
        </h2>
        {evaluations.length === 0 ? (
          <EmptyState title="No objectives yet" icon={AnalyticsIcon} />
        ) : (
          <div className="space-y-3">
            {evaluations.map(({ objective, progress, health }) => (
              <div key={objective.id} className="flex items-center gap-3 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{objective.title}</span>
                    <Badge tone={HEALTH_TONE[health.state]}>{health.state.replace("_", " ")}</Badge>
                  </div>
                  <ProgressBar value={progress.completionPercent} label={`${objective.title} completion`} className="mt-1.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Blocked Objectives <span className="font-normal text-text-muted">({blocked.length})</span>
        </h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-success">No blocked objectives.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {blocked.map(({ objective, health }) => (
              <li key={objective.id}>
                <p className="font-medium">{objective.title}</p>
                <p className="text-xs text-text-muted">{health.reasons.slice(0, 3).join("; ") || "Blocked."}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Upcoming Objectives <span className="font-normal text-text-muted">({upcoming.length})</span>
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-text-muted">No objectives with an upcoming due date.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {upcoming.map(({ objective, progress }) => {
              const remaining = daysUntil(objective.due_date as string, scorecard.evaluatedAt);
              return (
                <li key={objective.id} className="flex items-center justify-between gap-2">
                  <span>{objective.title}</span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {remaining < 0 ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`} · {progress.completionPercent}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Objective Completion Trend</h2>
        <p className="text-xs text-text-muted">Not available yet — this checkpoint stores only the latest evaluation, not a history of past scores, so there&apos;s no real trend to chart.</p>
      </Card>
    </div>
  );
}
