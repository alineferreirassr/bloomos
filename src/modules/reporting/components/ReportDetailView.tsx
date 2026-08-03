"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportsIcon } from "@/components/ui/icons";
import { computeReportAction, createReportSnapshotAction, archiveReportAction, restoreReportAction, getExecutiveReportInsightsAction, type ComputedSavedReport } from "@/modules/reporting/reportingActions";
import { exportReport } from "@/modules/reporting/export/exportReport";
import { formatMoney } from "@/lib/money";
import type { ReportExportFormat, ReportInsight, ReportSourceStatus } from "@/types/reporting";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: ComputedSavedReport };

const INSIGHT_TONE: Record<ReportInsight["severity"], BadgeTone> = { critical: "danger", warning: "warning", info: "neutral", positive: "success" };

const STATUS_TONE: Record<ReportSourceStatus, BadgeTone> = { ok: "success", stale: "warning", partial: "warning", unavailable: "danger" };
const EXPORT_FORMATS: { format: ReportExportFormat; label: string }[] = [
  { format: "csv", label: "CSV" },
  { format: "xlsx", label: "Excel" },
  { format: "pdf", label: "PDF" },
  { format: "print", label: "Print" },
];

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "N/A";
  if (unit === "currency") return formatMoney(Math.round(value), "USD");
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "duration_ms") return `${Math.round(value / 1000)}s`;
  return value.toLocaleString();
}

/**
 * v2.0 Checkpoint 42, Step 15 — a saved report's own detail page at
 * `/reports/[id]`. Renders the Report Computation Engine's own output
 * (`computeReportAction`) verbatim: per-metric values, source diagnostics,
 * and the period comparison — never re-derives or recomputes anything
 * client-side.
 */
export function ReportDetailView({ reportId }: { reportId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);
  const [executiveInsights, setExecutiveInsights] = useState<ReportInsight[]>([]);

  const fetchReport = () => {
    computeReportAction(reportId).then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchReport, [reportId]);

  useEffect(() => {
    if (state.status !== "ready" || state.data.report.category !== "executive") return;
    getExecutiveReportInsightsAction().then((result) => {
      if (result.success) setExecutiveInsights(result.data);
    });
  }, [state]);

  async function handleSnapshot() {
    await createReportSnapshotAction(reportId);
  }

  async function handleArchiveToggle() {
    if (state.status !== "ready") return;
    if (state.data.report.archived_at) await restoreReportAction(reportId);
    else await archiveReportAction(reportId);
    fetchReport();
  }

  async function handleExport(format: ReportExportFormat) {
    if (state.status !== "ready") return;
    setExporting(format);
    try {
      await exportReport(format, state.data.report, state.data.computed);
    } finally {
      setExporting(null);
    }
  }

  if (state.status === "loading") return <TableSkeleton rows={6} columns={4} />;
  if (state.status === "error") return <ErrorState message={state.message} />;

  const { report, computed } = state.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={report.title}
        subtitle={report.description || undefined}
        icon={ReportsIcon}
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: report.title }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {EXPORT_FORMATS.map(({ format, label }) => (
              <Button key={format} variant="secondary" disabled={exporting === format} onClick={() => handleExport(format)}>
                {label}
              </Button>
            ))}
            <Button variant="secondary" onClick={handleSnapshot}>
              Snapshot
            </Button>
            <Button variant="secondary" onClick={handleArchiveToggle}>
              {report.archived_at ? "Restore" : "Archive"}
            </Button>
          </div>
        }
      />

      {report.archived_at ? <Badge tone="neutral">Archived</Badge> : null}

      {computed.comparison.mode !== "none" ? (
        <Card className="p-4 text-sm text-text-muted">
          Comparing against {computed.comparison.comparable ? "the prior period" : "no comparable period"}
          {computed.comparison.missingPeriodReason ? ` — ${computed.comparison.missingPeriodReason}` : ""}
        </Card>
      ) : null}

      {computed.widgets.length === 0 ? (
        <EmptyState title="This report has no sections yet" description="Edit it in the Builder to add metrics." />
      ) : (
        computed.widgets.map((widget) => (
          <Card key={widget.section.id} className="p-6">
            <h3 className="text-base font-semibold">{widget.section.title}</h3>
            {widget.values.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No data available for this section.</p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {widget.values.map((value) => (
                  <div key={value.metricId} className="rounded-lg border border-border p-4">
                    <p className="text-xs text-text-muted">{value.label}</p>
                    <p className="mt-1 text-xl font-semibold">{formatValue(value.value, value.unit)}</p>
                    {value.changePercent !== null ? (
                      <p className={`mt-1 text-xs ${value.trend === "up" ? "text-success" : value.trend === "down" ? "text-danger" : "text-text-muted"}`}>
                        {value.changePercent >= 0 ? "+" : ""}
                        {value.changePercent.toFixed(1)}%
                      </p>
                    ) : null}
                    {value.notApplicableReason ? <p className="mt-1 text-xs text-text-muted">{value.notApplicableReason}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}

      {report.category === "executive" && executiveInsights.length > 0 ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Executive insights</h3>
          <p className="mt-1 text-xs text-text-muted">From the Executive Decisions queue — critical risks, business/operational risks, and recent improvements. No &ldquo;opportunities&rdquo; or &ldquo;recent regressions&rdquo; signal exists yet.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {executiveInsights.map((insight) => (
              <li key={insight.id} className="flex items-start gap-2 text-sm">
                <Badge tone={INSIGHT_TONE[insight.severity]}>{insight.label}</Badge>
                <span>{insight.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {computed.diagnostics.some((d) => d.status !== "ok") ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Source diagnostics</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {computed.diagnostics
              .filter((d) => d.status !== "ok")
              .map((diagnostic) => (
                <li key={diagnostic.metricId} className="flex items-center justify-between text-sm">
                  <span>{diagnostic.metricId}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[diagnostic.status]}>{diagnostic.status}</Badge>
                    {diagnostic.message ? <span className="text-xs text-text-muted">{diagnostic.message}</span> : null}
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
