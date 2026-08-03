"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ReportsIcon } from "@/components/ui/icons";
import { listReportMetricsAction, previewReportAction, createReportAction } from "@/modules/reporting/reportingActions";
import { REPORT_CATEGORIES, REPORT_PERIOD_KEYS, REPORT_COMPARISON_MODES } from "@/types/reporting";
import type { ReportCategory, ReportPeriodKey, ReportComparisonMode, ReportDefinition } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";
import type { ComputedReport } from "@/core/reporting/computationEngine";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; metrics: ReportMetricDefinition[] };

/**
 * v2.0 Checkpoint 42, Step 15 — the Report Builder at `/reports/builder`.
 * Metric/dimension/filter *selection* only — never arbitrary code
 * execution or raw DB access. Every metric offered here already passed
 * the discovery gate (`listReportMetricsAction`, Step 8), so nothing
 * hidden or unauthorized can ever appear in the picker. The live preview
 * calls `previewReportAction()` — the exact same Computation Engine
 * `computeReportAction()` uses for a saved report, never a second one.
 */
export function ReportBuilderView() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [title, setTitle] = useState("Untitled Report");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ReportCategory>("custom");
  const [periodKey, setPeriodKey] = useState<ReportPeriodKey>("30d");
  const [comparisonMode, setComparisonMode] = useState<ReportComparisonMode>("previous_period");
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<ComputedReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listReportMetricsAction().then((result) => {
      if (result.success) setState({ status: "ready", metrics: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, []);

  const metricsByCategory = useMemo(() => {
    if (state.status !== "ready") return new Map<ReportCategory, ReportMetricDefinition[]>();
    const grouped = new Map<ReportCategory, ReportMetricDefinition[]>();
    for (const metric of state.metrics) grouped.set(metric.category, [...(grouped.get(metric.category) ?? []), metric]);
    return grouped;
  }, [state]);

  function toggleMetric(metricId: string) {
    setSelectedMetricIds((current) => (current.includes(metricId) ? current.filter((id) => id !== metricId) : [...current, metricId]));
  }

  function buildDefinition(): ReportDefinition {
    return {
      title,
      description,
      category,
      sections: [{ id: "section_1", title: "Overview", chartType: "kpi", metricIds: selectedMetricIds, notes: null }],
      periodKey,
      customWindow: null,
      comparisonMode,
      customComparisonWindow: null,
      groupBy: null,
      sortBy: null,
      filters: [],
    };
  }

  async function handlePreview() {
    setPreviewing(true);
    const result = await previewReportAction(buildDefinition());
    setPreviewing(false);
    if (result.success) setPreview(result.data);
  }

  async function handleSave() {
    setSaving(true);
    const result = await createReportAction(buildDefinition());
    setSaving(false);
    if (result.success) router.push(`/reports/${result.data.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Report Builder"
        subtitle="Choose metrics and a period — no code, no raw queries."
        icon={ReportsIcon}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" disabled={previewing || selectedMetricIds.length === 0} onClick={handlePreview}>
              {previewing ? "Previewing…" : "Preview"}
            </Button>
            <Button variant="primary" disabled={saving || selectedMetricIds.length === 0} onClick={handleSave}>
              {saving ? "Saving…" : "Save Report"}
            </Button>
          </div>
        }
      />

      <Card className="flex flex-col gap-4 p-6">
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input className="rounded-md border border-border px-3 py-2 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <input className="rounded-md border border-border px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Category
            <select className="rounded-md border border-border px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
              {REPORT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Period
            <select className="rounded-md border border-border px-3 py-2 text-sm" value={periodKey} onChange={(e) => setPeriodKey(e.target.value as ReportPeriodKey)}>
              {REPORT_PERIOD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Comparison
            <select className="rounded-md border border-border px-3 py-2 text-sm" value={comparisonMode} onChange={(e) => setComparisonMode(e.target.value as ReportComparisonMode)}>
              {REPORT_COMPARISON_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {state.status === "loading" ? <TableSkeleton rows={5} columns={2} /> : null}
      {state.status === "error" ? <ErrorState message={state.message} /> : null}
      {state.status === "ready" ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Metrics</h3>
          <div className="mt-4 flex flex-col gap-5">
            {[...metricsByCategory.entries()].map(([cat, metrics]) => (
              <div key={cat}>
                <p className="text-xs uppercase tracking-wide text-text-muted">{cat}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {metrics.map((metric) => (
                    <label key={metric.id} className="flex items-start gap-2 rounded-md border border-border p-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={selectedMetricIds.includes(metric.id)} onChange={() => toggleMetric(metric.id)} />
                      <span>
                        <span className="font-medium">{metric.name}</span>
                        <span className="block text-xs text-text-muted">{metric.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {preview ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold">Preview</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.widgets.flatMap((widget) => widget.values).map((value) => (
              <div key={value.metricId} className="rounded-lg border border-border p-3">
                <p className="text-xs text-text-muted">{value.label}</p>
                <p className="mt-1 text-lg font-semibold">{value.value === null ? <Badge tone="neutral">N/A</Badge> : value.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
