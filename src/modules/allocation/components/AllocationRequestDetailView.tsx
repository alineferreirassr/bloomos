"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllocationRequestAction, listAllocationsForRequestAction, reEvaluateAllocationAction, compareAllocationProposalsAction } from "@/modules/allocation/allocationActions";
import type { AllocationRequest, Allocation, AllocationResult, AllocationComparisonResult } from "@/types/allocation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetsIcon, AnalyticsIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.1, Step 20 — Allocation Detail. One request's full
 * picture: its requirement lines, and every proposal (`Allocation`)
 * generated for it. Evaluating a proposal's scores/validation/explanation
 * (`reEvaluateAllocationAction`) and comparing proposals in the same
 * group (`compareAllocationProposalsAction`) are read operations — they
 * re-derive already-computed data, never re-select resources — so, same
 * as `evaluateWorkspaceSchedulingAction` on the Calendar Detail view,
 * they're wired directly into this read-only page. Approve/archive stay
 * unwired, matching every other platform dashboard's disclosed scope.
 */
const STATUS_TONE: Record<Allocation["status"], BadgeTone> = { draft: "neutral", proposed: "accent", approved: "success", failed: "danger", archived: "outline" };

function ScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold">{Math.round(value)}</p>
    </div>
  );
}

function AllocationCard({ allocation, onEvaluate, result }: { allocation: Allocation; onEvaluate: (id: string) => void; result: AllocationResult | null | "loading" }) {
  const selectedCount = allocation.candidates.filter((c) => c.selected).length;
  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{allocation.strategy.replace(/_/g, " ")}</p>
          <p className="text-xs text-text-muted">
            {selectedCount} resource{selectedCount === 1 ? "" : "s"} selected · group {allocation.group_id.slice(-8)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[allocation.status]}>{allocation.status}</Badge>
          <Button variant="secondary" onClick={() => onEvaluate(allocation.id)} disabled={result === "loading"}>
            {result === "loading" ? "Evaluating…" : "Evaluate"}
          </Button>
        </div>
      </div>

      {allocation.candidates.length > 0 ? (
        <ul role="list" className="mb-3">
          {allocation.candidates
            .filter((c) => c.selected)
            .map((c) => (
              <li key={`${c.resource_type}:${c.resource_id}`} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
                <span className="text-sm">
                  {c.resource_type} · {c.resource_id}
                </span>
                <span className="text-xs text-text-muted">line {c.requirement_line_index + 1}</span>
              </li>
            ))}
        </ul>
      ) : null}

      {result && result !== "loading" ? (
        <div className="border-t border-border/50 pt-3">
          <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ScoreItem label="Capability Fit" value={result.scores.capabilityFitScore} />
            <ScoreItem label="Schedule Fit" value={result.scores.scheduleFitScore} />
            <ScoreItem label="Availability Fit" value={result.scores.availabilityFitScore} />
            <ScoreItem label="Overall" value={result.scores.overallAllocationScore} />
          </div>
          <p className="mb-2 text-sm">{result.explanation.summary}</p>
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
        </div>
      ) : null}
    </Card>
  );
}

export function AllocationRequestDetailView({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState<AllocationRequest | null>(null);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultsByAllocationId, setResultsByAllocationId] = useState<Record<string, AllocationResult | "loading" | null>>({});
  const [comparison, setComparison] = useState<AllocationComparisonResult | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAllocationRequestAction(requestId).then(async (reqResult) => {
      if (cancelled) return;
      if (!reqResult.success) {
        setError(reqResult.error);
        return;
      }
      setRequest(reqResult.data);

      const allocResult = await listAllocationsForRequestAction(requestId);
      if (cancelled) return;
      if (allocResult.success) setAllocations(allocResult.data);
      else setError(allocResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  async function evaluate(allocationId: string) {
    setResultsByAllocationId((prev) => ({ ...prev, [allocationId]: "loading" }));
    const result = await reEvaluateAllocationAction(allocationId);
    setResultsByAllocationId((prev) => ({ ...prev, [allocationId]: result.success ? result.data : null }));
  }

  const groupIds = useMemo(() => Array.from(new Set((allocations ?? []).map((a) => a.group_id))), [allocations]);
  const comparableGroupId = useMemo(() => groupIds.find((gid) => (allocations ?? []).filter((a) => a.group_id === gid).length > 1) ?? null, [groupIds, allocations]);

  async function runComparison() {
    if (!comparableGroupId) return;
    setComparisonLoading(true);
    const result = await compareAllocationProposalsAction(comparableGroupId);
    if (result.success) setComparison(result.data);
    setComparisonLoading(false);
  }

  if (error) return <EmptyState title="This allocation request isn't available" description={error} icon={AssetsIcon} />;
  if (!request) return <p className="text-sm text-text-muted">Loading allocation request…</p>;

  const totalNeeded = request.required_resources.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div>
      <PageHeader
        title={`${request.context_type.replace(/_/g, " ")} allocation request`}
        subtitle={`${totalNeeded} resource${totalNeeded === 1 ? "" : "s"} needed from ${new Date(request.required_starts_at).toLocaleString()} to ${new Date(request.required_ends_at).toLocaleString()}.`}
        icon={AssetsIcon}
        breadcrumb={[{ label: "Resource Allocation", href: "/allocations" }, { label: "Request" }]}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Requirement Lines" value={String(request.required_resources.length)} icon={AssetsIcon} />
        <KpiCard label="Total Resources Needed" value={String(totalNeeded)} icon={AssetsIcon} />
        <KpiCard label="Proposals" value={String(allocations?.length ?? 0)} icon={AnalyticsIcon} />
        <KpiCard label="Priority" value={request.priority} icon={CheckIcon} />
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Requirement Lines <span className="font-normal text-text-muted">({request.required_resources.length})</span>
        </h2>
        <ul role="list">
          {request.required_resources.map((line, i) => (
            <li key={i} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">
                  {line.quantity}× {line.resource_type}
                </span>
                {line.notes ? <p className="mt-0.5 text-xs text-text-muted">{line.notes}</p> : null}
              </div>
              {line.capability_requirement_id ? <Badge tone="accent">capability requirement</Badge> : null}
            </li>
          ))}
        </ul>
      </Card>

      {request.special_instructions ? (
        <Card className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Special Instructions</h2>
          <p className="text-sm text-text-muted">{request.special_instructions}</p>
        </Card>
      ) : null}

      {comparableGroupId ? (
        <Card className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Compare Proposals</h2>
            <Button variant="secondary" onClick={runComparison} disabled={comparisonLoading}>
              {comparisonLoading ? "Comparing…" : "Compare"}
            </Button>
          </div>
          {comparison ? (
            <>
              <ul role="list" className="mb-3">
                {comparison.entries.map((e) => (
                  <li key={e.allocationId} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                    <span className="text-sm">{e.strategy.replace(/_/g, " ")}</span>
                    <span className="text-sm font-semibold">{e.scores.overallAllocationScore}</span>
                  </li>
                ))}
              </ul>
              {comparison.differences.length > 0 ? (
                <ul role="list">
                  {comparison.differences.map((d, i) => (
                    <li key={i} role="listitem" className="py-1 text-xs text-text-muted">
                      {d}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-text-muted">Multiple proposals share this request — compare their scores side by side.</p>
          )}
        </Card>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold">
        Proposals <span className="font-normal text-text-muted">({allocations?.length ?? 0})</span>
      </h2>
      {!allocations || allocations.length === 0 ? (
        <EmptyState title="No proposals yet" description="Proposals are generated by evaluating this request against a chosen allocation strategy." icon={AssetsIcon} />
      ) : (
        allocations.map((a) => <AllocationCard key={a.id} allocation={a} onEvaluate={evaluate} result={resultsByAllocationId[a.id] ?? null} />)
      )}

      <Link href="/allocations" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Resource Allocation
      </Link>
    </div>
  );
}
