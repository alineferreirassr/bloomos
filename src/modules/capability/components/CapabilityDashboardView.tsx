"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listCapabilityRequirementsAction } from "@/modules/capability/capabilityActions";
import { evaluateWorkforceCapabilityCoverageAction, type EvaluateWorkforceCapabilityCoverageResult } from "@/modules/capability/capabilityActions";
import type { CapabilityRequirement } from "@/types/capability";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamIcon, CheckIcon, AnalyticsIcon } from "@/components/ui/icons";

/**
 * v2.0 Checkpoint 26.1, Step 21 — Capability Dashboard. Every figure is
 * read straight from `evaluateWorkforceCapabilityCoverageAction`'s
 * already-computed result — no scheduling, no dispatch, no AI.
 *
 * Accessibility (Step 27): real `<button>`/`<a>` elements throughout,
 * `role="list"`/`listitem` for every list, an `aria-live` region for
 * status updates, and eligibility is always conveyed with a text label
 * alongside the badge color — never color alone.
 *
 * Performance (Step 28): groupings are `useMemo`-derived; coverage/risk
 * evaluation only runs on mount and on an explicit Re-evaluate click,
 * never on every render.
 */
const SEVERITY_TONE: Record<string, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

function RiskRow({ description, severity }: { description: string; severity: string }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <span className="text-sm">{description}</span>
      <Badge tone={SEVERITY_TONE[severity] ?? "neutral"}>{severity}</Badge>
    </li>
  );
}

function RequirementRow({ requirement }: { requirement: CapabilityRequirement }) {
  return (
    <li role="listitem" className="flex items-center justify-between gap-3 border-b border-border/50 py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium">{requirement.title}</span>
        <p className="mt-0.5 text-xs text-text-muted">{requirement.context_type.replace(/_/g, " ")}</p>
      </div>
      <Link href={`/assets/workforce/capabilities/${requirement.id}`}>
        <Button variant="secondary">View</Button>
      </Link>
    </li>
  );
}

export function CapabilityDashboardView() {
  const [requirements, setRequirements] = useState<CapabilityRequirement[] | null>(null);
  const [coverageResult, setCoverageResult] = useState<EvaluateWorkforceCapabilityCoverageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listCapabilityRequirementsAction(), evaluateWorkforceCapabilityCoverageAction()]).then(([reqResult, covResult]) => {
      if (cancelled) return;
      if (reqResult.success) setRequirements(reqResult.data);
      if (covResult.success) setCoverageResult(covResult.data);
      if (!reqResult.success) setError(reqResult.error);
      else if (!covResult.success) setError(covResult.error);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reevaluate() {
    setLoading(true);
    setError(null);
    const [reqResult, covResult] = await Promise.all([listCapabilityRequirementsAction(), evaluateWorkforceCapabilityCoverageAction()]);
    if (reqResult.success) setRequirements(reqResult.data);
    if (covResult.success) {
      setCoverageResult(covResult.data);
      setAnnouncement(`Re-evaluated ${covResult.data.evaluationResults.length} requirement(s).`);
    }
    if (!reqResult.success) setError(reqResult.error);
    else if (!covResult.success) setError(covResult.error);
    setLoading(false);
  }

  const highRisks = useMemo(() => coverageResult?.risks.filter((r) => r.severity === "high") ?? [], [coverageResult]);
  const otherRisks = useMemo(() => coverageResult?.risks.filter((r) => r.severity !== "high") ?? [], [coverageResult]);

  return (
    <div>
      <PageHeader
        title="Workforce Capability & Eligibility"
        subtitle="Who is eligible, who is the strongest match, and where the workforce has real coverage gaps — derived from Skills, Certifications, Availability, Equipment, and Vehicles."
        icon={AnalyticsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Workforce", href: "/assets/workforce" }, { label: "Capabilities" }]}
        actions={
          <Button variant="secondary" onClick={reevaluate} disabled={loading}>
            {loading ? "Evaluating…" : "Re-evaluate"}
          </Button>
        }
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {error ? <EmptyState title="Workforce Capabilities aren't available" description={error} icon={AnalyticsIcon} /> : null}

      {coverageResult ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Available Workers" value={String(coverageResult.coverage.availableWorkersCount)} icon={TeamIcon} />
            <KpiCard label="Active Teams" value={String(coverageResult.coverage.activeTeamsCount)} icon={TeamIcon} />
            <KpiCard label="Uncovered Requirements" value={String(coverageResult.coverage.uncoveredRequirementIds.length)} icon={AnalyticsIcon} />
            <KpiCard label="High-Risk Gaps" value={String(coverageResult.coverage.highRiskGapsCount)} icon={CheckIcon} />
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              High-Severity Risks <span className="font-normal text-text-muted">({highRisks.length})</span>
            </h2>
            {highRisks.length === 0 ? <p className="text-sm text-success">No high-severity workforce risks detected.</p> : <ul role="list">{highRisks.map((r) => <RiskRow key={r.id} description={r.description} severity={r.severity} />)}</ul>}
          </Card>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">
              Other Risks <span className="font-normal text-text-muted">({otherRisks.length})</span>
            </h2>
            {otherRisks.length === 0 ? <p className="text-sm text-text-muted">Nothing else to report.</p> : <ul role="list">{otherRisks.slice(0, 10).map((r) => <RiskRow key={r.id} description={r.description} severity={r.severity} />)}</ul>}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Capability Requirements <span className="font-normal text-text-muted">({requirements?.length ?? 0})</span>
            </h2>
            {!requirements || requirements.length === 0 ? (
              <EmptyState title="No capability requirements yet" description="Saved requirements are created through the Capability Requirement Registry." icon={AnalyticsIcon} />
            ) : (
              <ul role="list">{requirements.map((r) => <RequirementRow key={r.id} requirement={r} />)}</ul>
            )}
          </Card>
        </>
      ) : !error ? (
        <p className="text-sm text-text-muted">Evaluating workforce capability coverage…</p>
      ) : null}
    </div>
  );
}
