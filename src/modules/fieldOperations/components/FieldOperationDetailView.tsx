"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFieldOperationAction, evaluateFieldOperationAction } from "@/modules/fieldOperations/fieldOperationsActions";
import type { FieldOperation, ExecutionResult, ExecutionLifecycleState } from "@/types/fieldOperations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 29, Step 13 — Field Operation Detail. One operation's
 * full picture: its current execution session, lifecycle, operational
 * progress, health scores, and explanation. `evaluateFieldOperationAction`
 * is wired directly into this read-only view — the same deliberate
 * exception `DispatchDetailView.tsx`'s `evaluateDispatchOrderAction`
 * establishes: a genuine re-derivation of already-computed data, never a
 * mutation. Session lifecycle actions exist and are fully tested in
 * `fieldOperationsActions.ts`, but this view only reads — the same
 * disclosed "no create/mutate control wired yet" scope every prior
 * platform detail view in this codebase carries.
 *
 * The "Timeline" section renders the current session's own
 * `attempts: ExecutionAttempt[]` — the exact transition log the spec's 7
 * named Timeline events (Step 9) are emitted from — rather than
 * duplicating the global Timeline feed those events are already recorded
 * into via `recordTimelineActivity`.
 */
const LIFECYCLE_TONE: Record<ExecutionLifecycleState, BadgeTone> = {
  created: "neutral",
  waiting: "neutral",
  started: "accent",
  paused: "warning",
  resumed: "accent",
  completed: "success",
  cancelled: "outline",
  aborted: "danger",
  failed: "danger",
  archived: "outline",
};
const OPERATION_STATUS_TONE: Record<FieldOperation["status"], BadgeTone> = { active: "accent", completed: "success", cancelled: "danger", archived: "outline" };

function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function FieldOperationDetailView({ operationId }: { operationId: string }) {
  const [operation, setOperation] = useState<FieldOperation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionResult | "loading" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFieldOperationAction(operationId).then((operationResult) => {
      if (cancelled) return;
      if (operationResult.success) setOperation(operationResult.data);
      else setError(operationResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [operationId]);

  async function evaluate() {
    setResult("loading");
    const evalResult = await evaluateFieldOperationAction(operationId);
    setResult(evalResult.success ? evalResult.data : null);
  }

  if (error) return <EmptyState title="This field operation isn't available" description={error} icon={VendorsIcon} />;
  if (!operation) return <p className="text-sm text-text-muted">Loading field operation…</p>;

  const session = operation.sessions[operation.sessions.length - 1];
  const sortedAttempts = session.attempts.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <PageHeader
        title={`Field Operation #${operation.id.slice(-8)}`}
        subtitle={`${operation.priority} priority · ${operation.sessions.length} session${operation.sessions.length === 1 ? "" : "s"} · created ${new Date(operation.created_at).toLocaleString()}`}
        icon={VendorsIcon}
        breadcrumb={[{ label: "Field Operations", href: "/field-operations" }, { label: `Field Operation #${operation.id.slice(-8)}` }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={LIFECYCLE_TONE[session.lifecycle_state]}>{session.lifecycle_state}</Badge>
            <Badge tone={OPERATION_STATUS_TONE[operation.status]}>{operation.status}</Badge>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Current Phase" value={session.current_phase_id ?? "—"} icon={VendorsIcon} />
        <KpiCard label="Completed Steps" value={String(session.completed_step_ids.length)} icon={CheckIcon} />
        <KpiCard label="Completed Milestones" value={String(session.completed_milestone_ids.length)} icon={CheckIcon} />
        <KpiCard label="Transitions" value={String(session.attempts.length)} icon={CheckIcon} />
      </div>

      <Card className="mb-6">
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
                <p className="text-xs text-text-muted">Execution Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.executionHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Progress Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.progressHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Pause Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.pauseHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Completion Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.completionHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Lifecycle Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.lifecycleHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Overall</p>
                <p className="text-lg font-semibold">{Math.round(result.health.overallOperationalHealth)}</p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-text-muted">Elapsed Time</p>
                <p className="text-sm font-medium">{formatSeconds(result.state.elapsedTimeSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Pause Duration</p>
                <p className="text-sm font-medium">{formatSeconds(result.state.pauseDurationSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Execution Duration</p>
                <p className="text-sm font-medium">{formatSeconds(result.state.executionDurationSeconds)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Completion Duration</p>
                <p className="text-sm font-medium">{result.state.completionDurationSeconds === null ? "—" : formatSeconds(result.state.completionDurationSeconds)}</p>
              </div>
            </div>

            <p className="mb-1 text-sm">{result.explanation.summary}</p>
            <p className="mb-3 text-xs text-text-muted">{result.explanation.healthSummary}</p>

            {result.explanation.whyCannotStart.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Why execution cannot start</p>
                <ul role="list">
                  {result.explanation.whyCannotStart.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.explanation.whyPaused.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Why the session is paused</p>
                <ul role="list">
                  {result.explanation.whyPaused.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.explanation.whyFailed.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Why the session failed</p>
                <ul role="list">
                  {result.explanation.whyFailed.map((reason, i) => (
                    <li key={i} role="listitem" className="py-0.5 text-xs text-text-muted">
                      · {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.explanation.whyCompletionRejected.length > 0 ? (
              <div className="mb-2">
                <p className="text-xs font-semibold text-text-muted">Why completion was rejected</p>
                <ul role="list">
                  {result.explanation.whyCompletionRejected.map((reason, i) => (
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
          <p className="text-sm text-text-muted">Run an evaluation to see progress, health scores, and an explanation.</p>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">Operational Progress</h2>
        {result && result !== "loading" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Remaining Steps</p>
              <p className="text-lg font-semibold">{result.progress.remainingStepIds.length}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Pending Milestones</p>
              <p className="text-lg font-semibold">{result.progress.pendingMilestoneIds.length}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Checklist Progress</p>
              <p className="text-lg font-semibold">{Math.round(result.progress.checklistProgress)}%</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Deliverable Progress</p>
              <p className="text-lg font-semibold">{Math.round(result.progress.deliverableProgress)}%</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Run an evaluation to see operational progress.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Timeline <span className="font-normal text-text-muted">({sortedAttempts.length} transition{sortedAttempts.length === 1 ? "" : "s"})</span>
        </h2>
        {sortedAttempts.length === 0 ? (
          <p className="text-sm text-text-muted">No transitions recorded on this session yet.</p>
        ) : (
          <ul role="list">
            {sortedAttempts.map((attempt) => (
              <li key={attempt.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <Badge tone={LIFECYCLE_TONE[attempt.lifecycle_state]}>{attempt.lifecycle_state}</Badge>
                  {attempt.reason ? <span className="ml-2 text-xs text-text-muted">{attempt.reason}</span> : null}
                </div>
                <span className="text-xs text-text-muted">{new Date(attempt.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link href="/field-operations" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Field Operations
      </Link>
    </div>
  );
}
