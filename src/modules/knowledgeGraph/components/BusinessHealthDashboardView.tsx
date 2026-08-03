"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { evaluateBusinessHealthAction, type BusinessHealthEvaluation } from "@/modules/knowledgeGraph/businessHealthActions";
import { HEALTH_CATEGORY_LABELS } from "@/types/businessHealth";
import type { ReadinessScore } from "@/types/businessHealth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { AssetsIcon, AnalyticsIcon, CheckIcon, DocumentsIcon } from "@/components/ui/icons";
import { ObjectivesSection } from "@/modules/objectives/components/ObjectivesSection";

function scoreTone(score: number | null): BadgeTone {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function ReadinessTable({ title, scores }: { title: string; scores: ReadinessScore[] }) {
  if (scores.length === 0) return null;
  const worstFirst = [...scores].sort((a, b) => a.overallScore - b.overallScore).slice(0, 10);

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold">
        {title} <span className="font-normal text-text-muted">({scores.length})</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="py-2 pr-3">Record</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Blocking Issues</th>
              <th className="py-2 pr-3">Warnings</th>
              <th className="py-2 pr-3">Next Steps</th>
            </tr>
          </thead>
          <tbody>
            {worstFirst.map((score) => (
              <tr key={score.node.nodeId} className="border-b border-border/50 align-top">
                <td className="py-2 pr-3 font-mono text-xs text-text-muted">{score.node.nodeId}</td>
                <td className="py-2 pr-3">
                  <Badge tone={scoreTone(score.overallScore)}>{score.overallScore}</Badge>
                </td>
                <td className="py-2 pr-3 text-text-muted">{score.blockingIssues.length > 0 ? score.blockingIssues.join("; ") : "—"}</td>
                <td className="py-2 pr-3 text-text-muted">{score.warnings.length > 0 ? score.warnings.join("; ") : "—"}</td>
                <td className="py-2 pr-3 text-text-muted">{score.suggestedNextSteps.length > 0 ? score.suggestedNextSteps.map((r) => r.message).join("; ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scores.length > worstFirst.length ? <p className="mt-2 text-xs text-text-muted">Showing the {worstFirst.length} lowest-scoring of {scores.length} total.</p> : null}
    </Card>
  );
}

export function BusinessHealthDashboardView() {
  const [data, setData] = useState<BusinessHealthEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reevaluate() {
    setLoading(true);
    setError(null);
    const result = await evaluateBusinessHealthAction();
    if (result.success) setData(result.data);
    else setError(result.error);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    evaluateBusinessHealthAction().then((result) => {
      if (cancelled) return;
      if (result.success) setData(result.data);
      else setError(result.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allReadiness = data ? [...data.proposalReadiness, ...data.eventReadiness, ...data.clientReadiness, ...data.vendorReadiness] : [];
  const totalBlockingIssues = allReadiness.reduce((sum, s) => sum + s.blockingIssues.length, 0);
  const totalWarnings = allReadiness.reduce((sum, s) => sum + s.warnings.length, 0);
  const scoredCategories = data ? data.businessHealth.categories.filter((c) => c.score !== null) : [];

  return (
    <div>
      <PageHeader
        title="Business Health Dashboard"
        subtitle="Operational Intelligence — completeness, readiness, and business rule health across the workspace."
        icon={AnalyticsIcon}
        breadcrumb={[{ label: "Asset Library", href: "/assets" }, { label: "Knowledge Graph Explorer", href: "/assets/knowledge-graph" }, { label: "Business Health" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/assets/executive-decisions">
              <Button variant="secondary">Executive Decisions</Button>
            </Link>
            <Link href="/assets/workforce">
              <Button variant="secondary">Workforce</Button>
            </Link>
            <Button variant="secondary" onClick={reevaluate} disabled={loading}>
              {loading ? "Evaluating…" : "Re-evaluate"}
            </Button>
          </div>
        }
      />

      {error ? <EmptyState title="Business Health isn't available" description={error} icon={AnalyticsIcon} /> : null}

      {data ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Overall Health" value={String(data.businessHealth.overallScore)} icon={AnalyticsIcon} helper={`${scoredCategories.length} of ${data.businessHealth.categories.length} categories scored`} />
            <KpiCard label="Blocking Issues" value={String(totalBlockingIssues)} icon={CheckIcon} helper="Across every evaluated record" />
            <KpiCard label="Warnings" value={String(totalWarnings)} icon={DocumentsIcon} helper="Soft constraint & completeness gaps" />
            <KpiCard label="Records Evaluated" value={String(allReadiness.length)} icon={AssetsIcon} helper="Proposals, Events, Clients, Vendors" />
          </div>

          <Card className="mb-6">
            <h2 className="mb-3 text-sm font-semibold">Health Categories</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.businessHealth.categories.map((category) => (
                <div key={category.category} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium tracking-wide text-text-muted uppercase">{HEALTH_CATEGORY_LABELS[category.category]}</p>
                    <Badge tone={scoreTone(category.score)}>{category.score === null ? "N/A" : category.score}</Badge>
                  </div>
                  {category.notApplicableReason ? (
                    <p className="mt-1 text-xs text-text-muted">{category.notApplicableReason}</p>
                  ) : category.issues.length > 0 ? (
                    <p className="mt-1 text-xs text-text-muted">{category.issues.slice(0, 2).join("; ")}{category.issues.length > 2 ? ` (+${category.issues.length - 2} more)` : ""}</p>
                  ) : (
                    <p className="mt-1 text-xs text-success">No issues found.</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <ReadinessTable title="Proposal Readiness" scores={data.proposalReadiness} />
            <ReadinessTable title="Event Readiness" scores={data.eventReadiness} />
            <ReadinessTable title="Client Readiness" scores={data.clientReadiness} />
            <ReadinessTable title="Vendor Readiness" scores={data.vendorReadiness} />
          </div>

          <div className="mt-6">
            <ObjectivesSection />
          </div>
        </>
      ) : !error && loading ? (
        <p className="text-sm text-text-muted">Evaluating workspace health…</p>
      ) : null}
    </div>
  );
}
