"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDispatchOrderAction, evaluateDispatchOrderAction } from "@/modules/dispatch/dispatchActions";
import type { DispatchOrder, DispatchOrderResult, DispatchQueueState } from "@/types/dispatch";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VendorsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 28, Step 13 — Dispatch Detail. One order's full
 * picture: its assignments and their queue state/attempt history,
 * validation, health scores, and explanation. `evaluateDispatchOrderAction`
 * is wired directly into this read-only view — the same deliberate
 * exception `ExecutionPackageDetailView.tsx`'s `evaluateExecutionPackageAction`
 * establishes: a genuine re-derivation of already-computed data, never a
 * mutation. Accept/Decline/Cancel actions exist and are fully tested in
 * `dispatchActions.ts`, but this view only reads — the same disclosed
 * "no create/mutate control wired yet" scope every prior platform detail
 * view in this codebase carries.
 */
const DISPATCH_STATUS_TONE: Record<DispatchOrder["status"], BadgeTone> = { draft: "neutral", dispatched: "success", cancelled: "danger", archived: "outline" };
const QUEUE_STATE_TONE: Record<DispatchQueueState, BadgeTone> = {
  queued: "neutral",
  assigned: "accent",
  pending: "warning",
  accepted: "success",
  declined: "danger",
  cancelled: "outline",
  expired: "danger",
  completed_placeholder: "outline",
};

export function DispatchDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<DispatchOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DispatchOrderResult | "loading" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDispatchOrderAction(orderId).then((orderResult) => {
      if (cancelled) return;
      if (orderResult.success) setOrder(orderResult.data);
      else setError(orderResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  async function evaluate() {
    setResult("loading");
    const evalResult = await evaluateDispatchOrderAction(orderId);
    setResult(evalResult.success ? evalResult.data : null);
  }

  if (error) return <EmptyState title="This dispatch order isn't available" description={error} icon={VendorsIcon} />;
  if (!order) return <p className="text-sm text-text-muted">Loading dispatch order…</p>;

  const acceptedCount = order.assignments.filter((a) => a.queue_state === "accepted").length;
  const declinedCount = order.assignments.filter((a) => a.queue_state === "declined").length;
  const pendingCount = order.assignments.filter((a) => a.queue_state === "pending").length;

  return (
    <div>
      <PageHeader
        title={`Order #${order.id.slice(-8)}`}
        subtitle={`${order.priority} priority · ${order.source.replace(/_/g, " ")} · created ${new Date(order.created_at).toLocaleString()}`}
        icon={VendorsIcon}
        breadcrumb={[{ label: "Dispatch", href: "/dispatch" }, { label: `Order #${order.id.slice(-8)}` }]}
        actions={<Badge tone={DISPATCH_STATUS_TONE[order.status]}>{order.status}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Assignments" value={String(order.assignments.length)} icon={VendorsIcon} />
        <KpiCard label="Accepted" value={String(acceptedCount)} icon={CheckIcon} />
        <KpiCard label="Pending" value={String(pendingCount)} icon={CheckIcon} />
        <KpiCard label="Declined" value={String(declinedCount)} icon={CheckIcon} />
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
            <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-text-muted">Assignment Coverage</p>
                <p className="text-lg font-semibold">{Math.round(result.health.assignmentCoverage)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Acceptance Rate</p>
                <p className="text-lg font-semibold">{Math.round(result.health.acceptanceRate)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Queue Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.queueHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Overall</p>
                <p className="text-lg font-semibold">{Math.round(result.health.overallDispatchHealth)}</p>
              </div>
            </div>
            <p className="mb-2 text-sm">{result.explanation.summary}</p>
            <p className="mb-3 text-xs text-text-muted">Queue: {result.explanation.queueStatus}</p>
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
          <p className="text-sm text-text-muted">Run an evaluation to see validation, health scores, and readiness.</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">
          Assignments <span className="font-normal text-text-muted">({order.assignments.length})</span>
        </h2>
        {order.assignments.length === 0 ? (
          <p className="text-sm text-text-muted">No assignments on this order.</p>
        ) : (
          <ul role="list">
            {order.assignments.map((a) => (
              <li key={a.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">
                    {a.resource_type} · {a.resource_id}
                  </span>
                  {a.reason ? <p className="mt-0.5 text-xs text-text-muted">{a.reason}</p> : null}
                </div>
                <span className="text-xs text-text-muted">{a.attempts.length} attempt{a.attempts.length === 1 ? "" : "s"}</span>
                <Badge tone={QUEUE_STATE_TONE[a.queue_state]}>{a.queue_state.replace(/_/g, " ")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link href="/dispatch" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Dispatch
      </Link>
    </div>
  );
}
