"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ReportsIcon } from "@/components/ui/icons";
import { evaluateReportingAnalyticsAction, evaluateReportingHealthAction } from "@/modules/reporting/reportingActions";
import type { ReportingAnalytics } from "@/types/reportingAnalytics";
import type { ReportingHealthReport } from "@/types/reportingHealth";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; analytics: ReportingAnalytics; health: ReportingHealthReport };

function healthTone(score: number | null): BadgeTone {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function categoryLabel(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * v2.0 Checkpoint 42, Step 15 — Reporting Analytics + Health at
 * `/reports/analytics`. Composes `evaluateReportingAnalyticsAction()`
 * (Step 10) and `evaluateReportingHealthAction()` (Step 9) unchanged —
 * this view formats their output, it computes nothing itself.
 */
export function ReportingAnalyticsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    Promise.all([evaluateReportingAnalyticsAction(), evaluateReportingHealthAction()]).then(([analyticsResult, healthResult]) => {
      if (analyticsResult.success && healthResult.success) setState({ status: "ready", analytics: analyticsResult.data, health: healthResult.data });
      else setState({ status: "error", message: !analyticsResult.success ? analyticsResult.error : !healthResult.success ? healthResult.error : "Unknown error" });
    });
  }, []);

  if (state.status === "loading") return <TableSkeleton rows={6} columns={4} />;
  if (state.status === "error") return <ErrorState message={state.message} />;

  const { analytics, health } = state;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reporting Analytics" subtitle="Usage of the Reporting Platform itself, and its own operational health." icon={ReportsIcon} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Reports created" value={String(analytics.reportsCreated)} icon={ReportsIcon} />
        <KpiCard label="Reports viewed" value={String(analytics.reportsViewed)} icon={ReportsIcon} />
        <KpiCard label="Snapshots generated" value={String(analytics.snapshotsGenerated)} icon={ReportsIcon} />
        <KpiCard label="Failed sources" value={String(analytics.failedReportSources)} icon={ReportsIcon} />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Overall health</h3>
          <Badge tone={healthTone(health.overallScore)}>{health.overallScore}/100</Badge>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {health.categories.map((category) => (
            <div key={category.category} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">{categoryLabel(category.category)}</p>
                <Badge tone={healthTone(category.score)}>{category.score === null ? "N/A" : category.score}</Badge>
              </div>
              {category.notApplicableReason ? <p className="mt-1 text-xs text-text-muted">{category.notApplicableReason}</p> : null}
            </div>
          ))}
        </div>
      </Card>

      {analytics.mostViewedReports.length > 0 ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Most viewed reports</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {analytics.mostViewedReports.map((ranking) => (
              <li key={ranking.key} className="flex items-center justify-between text-sm">
                <span>{ranking.label}</span>
                <span className="text-text-muted">{ranking.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {health.findings.length > 0 ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Findings</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {health.findings.map((finding) => (
              <li key={finding.ruleId} className="flex items-center gap-2 text-sm">
                <Badge tone={finding.severity === "critical" ? "danger" : finding.severity === "warning" ? "warning" : "neutral"}>{finding.severity}</Badge>
                <span>{finding.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
