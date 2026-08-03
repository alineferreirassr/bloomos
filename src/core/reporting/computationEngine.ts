import { clockNow } from "@/core/time/clock";
import { getLogger } from "@/core/observability/logger";
import { listVisibleReportMetrics } from "@/core/reporting/discovery";
import { getReportMetric } from "@/core/reporting/metricRegistry";
import { validateReportFilters } from "@/core/reporting/filterEngine";
import { resolveReportWindow, buildReportComparison } from "@/core/reporting/periodEngine";
import { sortReportValues } from "@/core/reporting/resultGrouping";
import { compareTrend } from "@/core/analytics/engine";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { ReportDefinition, ReportMetricValue, ReportSourceDiagnostic, ReportWidget, ReportComparisonResult } from "@/types/reporting";
import type { ReportMetricContext } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42, Step 4 — the deterministic Report Computation
 * Engine. Resolves every metric a `ReportDefinition` references through
 * the Report Metric Registry (`core/reporting/metricRegistry.ts`), never
 * fetching or aggregating data itself. Mirrors `core/analytics/engine.ts`'s
 * own `computeVisibleMetrics()`/`computeOne()` "never let one bad metric
 * blank the whole dashboard" discipline exactly — a single metric's
 * `compute()` throwing, being hidden by permissions, or declaring itself
 * not applicable all become one line of `ReportSourceDiagnostic`, never a
 * thrown error that takes the rest of the report down with it.
 */

export interface ComputeReportParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
  definition: ReportDefinition;
  now?: Date;
}

export interface ComputedReport {
  widgets: ReportWidget[];
  comparison: ReportComparisonResult;
  diagnostics: ReportSourceDiagnostic[];
  sourceTimestamps: Record<string, string>;
  /** Real, measured wall-clock time for this `computeReport()` call — feeds the Reporting Health Engine's `performance` category (Step 9). Never a fabricated benchmark. */
  totalDurationMs: number;
}

async function computeOneMetricValue(
  metricId: string,
  context: ReportMetricContext,
  visibleIds: Set<string>,
  evaluatedAt: string,
): Promise<{ value: ReportMetricValue | null; diagnostic: ReportSourceDiagnostic; sourceTimestamp: string | null }> {
  const definition = getReportMetric(metricId);
  if (!definition) {
    return { value: null, diagnostic: { metricId, status: "unavailable", message: "This metric is no longer registered." }, sourceTimestamp: null };
  }
  if (!visibleIds.has(metricId)) {
    return { value: null, diagnostic: { metricId, status: "unavailable", message: "You don't have permission to view this metric." }, sourceTimestamp: null };
  }

  const { applied, ignored } = validateReportFilters(context.filters, definition);
  const started = Date.now();
  try {
    const result = await definition.compute({ ...context, filters: applied });
    getLogger().info("Report metric computed", { workspaceId: context.workspaceId, metricId, durationMs: Date.now() - started });

    const value: ReportMetricValue = {
      metricId,
      label: definition.name,
      unit: result.unit,
      value: result.value,
      previousValue: result.previousValue,
      changePercent: result.value !== null ? compareTrend(result.value, result.previousValue).changePercent : null,
      trend: result.value !== null ? compareTrend(result.value, result.previousValue).trend : "flat",
      series: result.series,
      breakdown: result.breakdown,
      notApplicableReason: result.notApplicableReason,
    };

    let status: ReportSourceDiagnostic["status"] = "ok";
    let message: string | null = null;
    if (result.notApplicableReason) {
      status = "unavailable";
      message = result.notApplicableReason;
    } else if (result.stale) {
      status = "stale";
      message = "This metric's underlying data may not be current.";
    } else if (result.partial) {
      status = "partial";
      message = "This metric could only be computed from part of its source data.";
    } else if (ignored.length > 0) {
      status = "partial";
      message = `${ignored.length} filter(s) aren't supported by this metric and were ignored: ${ignored.map((f) => f.key).join(", ")}.`;
    }

    return { value, diagnostic: { metricId, status, message }, sourceTimestamp: evaluatedAt };
  } catch (error) {
    getLogger().error("Report metric computation failed", { workspaceId: context.workspaceId, metricId, durationMs: Date.now() - started, error: error instanceof Error ? error.message : "Unknown error" });
    return { value: null, diagnostic: { metricId, status: "unavailable", message: "This metric failed to compute." }, sourceTimestamp: null };
  }
}

export async function computeReport(params: ComputeReportParams): Promise<ComputedReport> {
  const startedAt = Date.now();
  const now = params.now ?? clockNow();
  const evaluatedAt = now.toISOString();
  const { definition } = params;

  const window = resolveReportWindow(definition.periodKey, definition.customWindow, now);
  const comparison = buildReportComparison(window, definition.comparisonMode, definition.customComparisonWindow);

  const visibleMetrics = await listVisibleReportMetrics({ workspaceId: params.workspaceId, permissions: params.permissions, role: params.role });
  const visibleIds = new Set(visibleMetrics.map((m) => m.id));

  const context: ReportMetricContext = {
    workspaceId: params.workspaceId,
    permissions: params.permissions,
    role: params.role,
    window,
    comparisonWindow: comparison.comparisonWindow,
    filters: definition.filters,
  };

  const diagnostics: ReportSourceDiagnostic[] = [];
  const sourceTimestamps: Record<string, string> = {};

  const widgets: ReportWidget[] = await Promise.all(
    definition.sections.map(async (section) => {
      const computed = await Promise.all(section.metricIds.map((metricId) => computeOneMetricValue(metricId, context, visibleIds, evaluatedAt)));
      const values: ReportMetricValue[] = [];
      for (const entry of computed) {
        diagnostics.push(entry.diagnostic);
        if (entry.value) values.push(entry.value);
        if (entry.sourceTimestamp) sourceTimestamps[entry.diagnostic.metricId] = entry.sourceTimestamp;
      }
      return { section, values: sortReportValues(values, definition.sortBy) };
    }),
  );

  return { widgets, comparison, diagnostics, sourceTimestamps, totalDurationMs: Date.now() - startedAt };
}
