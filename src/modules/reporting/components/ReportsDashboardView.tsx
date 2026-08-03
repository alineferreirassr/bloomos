"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportsIcon } from "@/components/ui/icons";
import { listReportsAction, evaluateReportingAnalyticsAction } from "@/modules/reporting/reportingActions";
import type { SavedReport } from "@/types/reporting";
import type { ReportingAnalytics } from "@/types/reportingAnalytics";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; reports: SavedReport[] };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * v2.0 Checkpoint 42, Step 15 — the Reporting Center at `/reports`. Lists
 * every saved report the member can see, plus a small usage summary
 * (`evaluateReportingAnalyticsAction`) and entry points into the other
 * five routes (Builder/Templates/Snapshots/Analytics/report detail) —
 * never a second reporting engine of its own.
 */
export function ReportsDashboardView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [analytics, setAnalytics] = useState<ReportingAnalytics | null>(null);

  useEffect(() => {
    listReportsAction().then((result) => {
      if (result.success) setState({ status: "ready", reports: result.data });
      else setState({ status: "error", message: result.error });
    });
    evaluateReportingAnalyticsAction().then((result) => {
      if (result.success) setAnalytics(result.data);
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle="Composed, saved reports over every module's own metrics."
        icon={ReportsIcon}
        actions={
          <div className="flex gap-2">
            <Link href="/reports/templates">
              <Button variant="secondary">Templates</Button>
            </Link>
            <Link href="/reports/builder">
              <Button variant="primary">New Report</Button>
            </Link>
          </div>
        }
      />

      {analytics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Reports" value={String(analytics.reportsCreated)} icon={ReportsIcon} href="/reports" />
          <KpiCard label="Snapshots" value={String(analytics.snapshotsGenerated)} icon={ReportsIcon} href="/reports/snapshots" />
          <KpiCard label="Templates used" value={String(analytics.templatesUsed)} icon={ReportsIcon} href="/reports/templates" />
          <KpiCard label="Reports with no data" value={String(analytics.noDataReports)} icon={ReportsIcon} href="/reports/analytics" />
        </div>
      ) : null}

      {state.status === "loading" ? <TableSkeleton rows={5} columns={4} /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" && state.reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Start from a template or build your own from scratch."
          action={
            <Link href="/reports/templates">
              <Button variant="primary">Browse templates</Button>
            </Link>
          }
        />
      ) : null}
      {state.status === "ready" && state.reports.length > 0 ? (
        <div className="flex flex-col gap-3">
          {state.reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`}>
              <Card className="flex items-center justify-between p-4 transition hover:border-accent">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="text-xs text-text-muted">{report.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="outline">{report.category}</Badge>
                  <span className="text-xs text-text-muted">Updated {formatDate(report.updated_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
