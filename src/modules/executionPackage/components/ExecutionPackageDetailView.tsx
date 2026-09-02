"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getExecutionPackageAction, evaluateExecutionPackageAction } from "@/modules/executionPackage/executionPackageActions";
import type { ExecutionPackage, ExecutionPackageResult } from "@/types/executionPackage";
import type { DeliverableStatus } from "@/types/operationalPlanning";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { InventoryIcon, CheckIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 27.3, Step 15 — Execution Package Detail. One package's
 * full picture: its current version's frozen snapshot (allocation,
 * schedule, operational plan, deliverables, evidence, checklists,
 * dependencies), its generated instructions, and its version history.
 * `evaluateExecutionPackageAction` is wired directly into this
 * read-only view — the one deliberate exception, matching
 * `OperationalPlanDetailView.tsx`'s `evaluateOperationalPlanAction`
 * precedent: it's a genuine re-derivation of already-computed data,
 * never a mutation.
 */
const PACKAGE_STATUS_TONE: Record<ExecutionPackage["status"], BadgeTone> = { draft: "neutral", validated: "outline", approved: "success", archived: "neutral" };
const DELIVERABLE_STATUS_TONE: Record<DeliverableStatus, BadgeTone> = { pending: "neutral", ready: "outline", delivered: "success", rejected: "danger" };

export function ExecutionPackageDetailView({ packageId }: { packageId: string }) {
  const [pkg, setPkg] = useState<ExecutionPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionPackageResult | "loading" | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExecutionPackageAction(packageId).then((pkgResult) => {
      if (cancelled) return;
      if (pkgResult.success) setPkg(pkgResult.data);
      else setError(pkgResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  async function evaluate() {
    setResult("loading");
    const evalResult = await evaluateExecutionPackageAction(packageId);
    setResult(evalResult.success ? evalResult.data : null);
  }

  if (error) return <EmptyState title="This execution package isn't available" description={error} icon={InventoryIcon} />;
  if (!pkg) return <p className="text-sm text-text-muted">Loading execution package…</p>;

  const currentVersion = pkg.versions.find((v) => v.id === pkg.current_version_id) ?? pkg.versions[pkg.versions.length - 1];
  const snapshot = currentVersion.snapshot;

  return (
    <div>
      <PageHeader
        title={pkg.metadata.title}
        subtitle={`${pkg.context.context_type.replace(/_/g, " ")} · version ${currentVersion.version_number} · captured ${new Date(snapshot.captured_at).toLocaleString()}`}
        icon={InventoryIcon}
        breadcrumb={[{ label: "Execution Packages", href: "/execution-packages" }, { label: pkg.metadata.title }]}
        actions={<Badge tone={PACKAGE_STATUS_TONE[pkg.status]}>{pkg.status}</Badge>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Versions" value={String(pkg.versions.length)} icon={InventoryIcon} />
        <KpiCard label="Deliverables" value={String(snapshot.deliverables.length)} icon={CheckIcon} />
        <KpiCard label="Evidence Requirements" value={String(snapshot.evidence_requirements.length)} icon={CheckIcon} />
        <KpiCard label="Dependency Checks" value={String(snapshot.dependency_checks.length)} icon={CheckIcon} />
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
              <div>
                <p className="text-xs text-text-muted">Planning Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.planningHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Allocation Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.allocationHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Operational Health</p>
                <p className="text-lg font-semibold">{Math.round(result.health.operationalHealth)}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Overall</p>
                <p className="text-lg font-semibold">{Math.round(result.health.overallPackageHealth)}</p>
              </div>
            </div>
            <p className="mb-2 text-sm">{result.explanation.summary}</p>
            <p className="mb-3 text-xs text-text-muted">Readiness: {result.readiness.state.replace(/_/g, " ")}</p>
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
      </LuxuryCard>

      <SectionHeader title="Snapshot" />
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">Snapshot — Allocation, Schedule &amp; Plan</h2>
          <ul role="list">
            <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2">
              <span className="text-sm">Allocation</span>
              <Badge tone={snapshot.allocation_id ? "success" : "neutral"}>{snapshot.allocation_id ?? "none"}</Badge>
            </li>
            <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2">
              <span className="text-sm">Schedule</span>
              <Badge tone={snapshot.appointment_id ? "success" : "neutral"}>{snapshot.appointment_id ?? "none"}</Badge>
            </li>
            <li role="listitem" className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm">Operational Plan</span>
              <Badge tone={snapshot.operational_plan_id ? "success" : "neutral"}>{snapshot.operational_plan_id ?? "none"}</Badge>
            </li>
          </ul>
        </LuxuryCard>

        <LuxuryCard>
          <h2 className="mb-3 text-sm font-semibold">
            Deliverables &amp; Evidence <span className="font-normal text-text-muted">({snapshot.deliverables.length + snapshot.evidence_requirements.length})</span>
          </h2>
          {snapshot.deliverables.length === 0 && snapshot.evidence_requirements.length === 0 ? (
            <p className="text-sm text-text-muted">None declared.</p>
          ) : (
            <ul role="list">
              {snapshot.deliverables.map((d) => (
                <li key={d.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{d.title}</span>
                  <Badge tone={DELIVERABLE_STATUS_TONE[d.status]}>{d.status}</Badge>
                </li>
              ))}
              {snapshot.evidence_requirements.map((e) => (
                <li key={e.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
                  <span className="text-sm">{e.description}</span>
                  <Badge tone="neutral">{e.type.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>
      </div>

      <SectionHeader title="Instructions" />
      <LuxuryCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold">
          Instructions <span className="font-normal text-text-muted">({currentVersion.instructions.sections.length})</span>
        </h2>
        {currentVersion.instructions.sections.length === 0 ? (
          <p className="text-sm text-text-muted">No structured instructions yet.</p>
        ) : (
          <ul role="list">
            {currentVersion.instructions.sections.map((line, i) => (
              <li key={i} role="listitem" className="flex items-center gap-3 border-b border-border/50 py-2 last:border-b-0">
                <Badge tone="neutral">{line.section}</Badge>
                <span className="text-sm">{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>

      <SectionHeader title="Version History" />
      <LuxuryCard>
        <h2 className="mb-3 text-sm font-semibold">
          Version History <span className="font-normal text-text-muted">({pkg.versions.length})</span>
        </h2>
        <ul role="list">
          {pkg.versions.map((v) => (
            <li key={v.id} role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">Version {v.version_number}</span>
                {v.reason ? <p className="mt-0.5 text-xs text-text-muted">{v.reason}</p> : null}
              </div>
              <span className="text-xs text-text-muted">{new Date(v.created_at).toLocaleString()}</span>
              {v.id === pkg.current_version_id ? <Badge tone="success">current</Badge> : null}
            </li>
          ))}
        </ul>
      </LuxuryCard>

      <Link href="/execution-packages" className="mt-2 inline-block text-sm text-accent hover:underline">
        ← Back to Execution Packages
      </Link>
    </div>
  );
}
