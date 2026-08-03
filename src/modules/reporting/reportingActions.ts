"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { DataResult } from "@/lib/data/result";

import { registerBuiltinReportMetrics } from "@/modules/reporting/registerBuiltinReportMetrics";
import { registerBuiltinReportTemplates } from "@/modules/reporting/registerBuiltinReportTemplates";
import { listVisibleReportMetrics } from "@/core/reporting/discovery";
import { listReportMetrics } from "@/core/reporting/metricRegistry";
import { listReportTemplates, getReportTemplate } from "@/core/reporting/templateRegistry";
import { computeReport, type ComputedReport } from "@/core/reporting/computationEngine";
import { computeReportingHealth } from "@/core/reporting/reportingHealthEngine";
import { computeReportingAnalytics } from "@/core/reporting/reportingAnalyticsEngine";
import { listReports, getReport, createReport, updateReport, archiveReport, restoreReport, type CreateReportInput } from "@/lib/data/core/reporting/reportsStore";
import { listSnapshots, getSnapshot, createSnapshot } from "@/lib/data/core/reporting/snapshotsStore";
import { recordReportComputationDuration, getRecentReportComputationDurations } from "@/lib/data/core/reporting/performanceSamplesStore";
import { readWorkspaceFavorites } from "@/lib/data/mock/workspaceFavoritesStore";
import { readWorkspaceRecentItems } from "@/lib/data/mock/workspaceRecentItemsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { evaluateExecutiveDecisionsAction } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { REPORT_DIMENSIONS, REPORT_FILTER_KEYS } from "@/types/reporting";
import type { ReportCategory, ReportDefinition, ReportDimensionKey, ReportFilterKey, ReportInsight, ReportSnapshot, ReportTemplate, SavedReport } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";
import type { ReportingHealthReport } from "@/types/reportingHealth";
import type { ReportingAnalytics } from "@/types/reportingAnalytics";

/**
 * v2.0 Checkpoint 42, Step 8 — the Reporting Platform's module actions
 * layer. Every read/write here composes the engines already built in
 * Steps 1-7 (`core/reporting/*`, `lib/data/core/reporting/*`); this file
 * adds no new business logic of its own, only session resolution and
 * permission gating — the same shape every other platform's own
 * `*Actions.ts` module layer already uses (see
 * `modules/notifications/notificationPlatformActions.ts`).
 *
 * Favorite/pin/recent-item behavior for a report is deliberately NOT
 * duplicated here — call the existing generic
 * `toggleFavoriteAction`/`togglePinnedFavoriteAction`/`recordRecentItemAction`
 * (`modules/workspace/workspaceActions.ts`) with `entityType: "report"`,
 * the same reuse Checkpoint 38's Favorites/Recent Items engine already
 * supports for every other entity type.
 */

registerBuiltinReportMetrics();
registerBuiltinReportTemplates();

const GENERIC_ACCESS_ERROR = "Reports aren't available. You may not have access to them.";

async function requireReportsPermission(permission: "reports.view" | "reports.build" | "reports.manage" | "reports.snapshots" | "reports.executive") {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes(permission)) return null;
  return session;
}

// --- Report Builder: metrics, dimensions, filters, templates ------------------

export async function listReportMetricsAction(category?: ReportCategory): Promise<DataResult<ReportMetricDefinition[]>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const metrics = await listVisibleReportMetrics({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role, category });
  return { success: true, data: metrics };
}

/** Every dimension in the closed set — the Report Builder cross-references this against a chosen metric's own `supportedDimensions` to decide what's actually selectable, never bypassing that per-metric contract. */
export async function listReportDimensionsAction(): Promise<DataResult<readonly ReportDimensionKey[]>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: REPORT_DIMENSIONS };
}

export async function listReportFiltersAction(): Promise<DataResult<readonly ReportFilterKey[]>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: REPORT_FILTER_KEYS };
}

export async function listReportTemplatesAction(): Promise<DataResult<ReportTemplate[]>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: listReportTemplates() };
}

export async function getReportTemplateAction(id: string): Promise<DataResult<ReportTemplate>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const template = getReportTemplate(id);
  if (!template) return { success: false, error: "Template not found." };
  return { success: true, data: template };
}

// --- Saved reports: CRUD --------------------------------------------------------

export async function listReportsAction(includeArchived = false): Promise<DataResult<SavedReport[]>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await listReports(session.workspace.id, includeArchived) };
}

export async function getReportAction(id: string): Promise<DataResult<SavedReport>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const report = await getReport(session.workspace.id, id);
  if (!report) return { success: false, error: "Report not found." };
  return { success: true, data: report };
}

/** Gated on `reports.build` — creating a report (from a template or from scratch in the Builder) is a distinct, narrower permission from just viewing existing reports. */
export async function createReportAction(input: CreateReportInput): Promise<DataResult<SavedReport>> {
  const session = await requireReportsPermission("reports.build");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await createReport(session.workspace.id, session.membership.id, input);
  if (result.success) {
    recordTimelineActivity(session.workspace.id, "report", result.data.id, "report_created", `Report "${result.data.title}" created`);
    if (result.data.source_template_id === null) recordTimelineActivity(session.workspace.id, "report", result.data.id, "report_saved", `Report "${result.data.title}" saved`);
  }
  return result;
}

export async function updateReportAction(id: string, patch: Partial<ReportDefinition>): Promise<DataResult<SavedReport>> {
  const session = await requireReportsPermission("reports.build");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await updateReport(session.workspace.id, id, patch);
  if (result.success) recordTimelineActivity(session.workspace.id, "report", result.data.id, "report_updated", `Report "${result.data.title}" updated`);
  return result;
}

export async function archiveReportAction(id: string): Promise<DataResult<SavedReport>> {
  const session = await requireReportsPermission("reports.manage");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await archiveReport(session.workspace.id, id);
  if (result.success) recordTimelineActivity(session.workspace.id, "report", result.data.id, "report_archived", `Report "${result.data.title}" archived`);
  return result;
}

export async function restoreReportAction(id: string): Promise<DataResult<SavedReport>> {
  const session = await requireReportsPermission("reports.manage");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await restoreReport(session.workspace.id, id);
  if (result.success) recordTimelineActivity(session.workspace.id, "report", result.data.id, "report_restored", `Report "${result.data.title}" restored`);
  return result;
}

// --- Computation -----------------------------------------------------------------

/** Runs the Report Computation Engine over an in-memory `ReportDefinition` — used by the Builder's own live preview, before (or without) ever saving it. */
export async function previewReportAction(definition: ReportDefinition): Promise<DataResult<ComputedReport>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const computed = await computeReport({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role, definition });
  recordReportComputationDuration(session.workspace.id, computed.totalDurationMs);
  return { success: true, data: computed };
}

export interface ComputedSavedReport {
  report: SavedReport;
  computed: ComputedReport;
}

/** Loads a saved report and computes it fresh (never a cached read) — the render model for `/reports/[id]`. */
export async function computeReportAction(id: string): Promise<DataResult<ComputedSavedReport>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const report = await getReport(session.workspace.id, id);
  if (!report) return { success: false, error: "Report not found." };
  const computed = await computeReport({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role, definition: report });
  recordReportComputationDuration(session.workspace.id, computed.totalDurationMs);
  recordTimelineActivity(session.workspace.id, "report", report.id, "report_viewed", `Report "${report.title}" viewed`);
  return { success: true, data: { report, computed } };
}

// --- Snapshots ---------------------------------------------------------------------

export async function listReportSnapshotsAction(reportId: string): Promise<DataResult<ReportSnapshot[]>> {
  const session = await requireReportsPermission("reports.snapshots");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: listSnapshots(session.workspace.id, reportId) };
}

/** Cross-report snapshot browsing for `/reports/snapshots` — the one place a member sees every snapshot across every one of their workspace's reports, newest first. */
export async function listAllReportSnapshotsAction(): Promise<DataResult<{ snapshot: ReportSnapshot; reportTitle: string }[]>> {
  const session = await requireReportsPermission("reports.snapshots");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const reports = await listReports(session.workspace.id, true);
  const entries = reports
    .flatMap((report) => listSnapshots(session.workspace.id, report.id).map((snapshot) => ({ snapshot, reportTitle: report.title })))
    .sort((a, b) => b.snapshot.generated_at.localeCompare(a.snapshot.generated_at));
  return { success: true, data: entries };
}

export async function getReportSnapshotAction(id: string): Promise<DataResult<ReportSnapshot>> {
  const session = await requireReportsPermission("reports.snapshots");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const snapshot = getSnapshot(session.workspace.id, id);
  if (!snapshot) return { success: false, error: "Snapshot not found." };
  return { success: true, data: snapshot };
}

/** Computes the report fresh, then persists that exact result immutably — Step 6's own contract: a snapshot is never re-derived from a later state. */
export async function createReportSnapshotAction(reportId: string): Promise<DataResult<ReportSnapshot>> {
  const session = await requireReportsPermission("reports.snapshots");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const report = await getReport(session.workspace.id, reportId);
  if (!report) return { success: false, error: "Report not found." };

  const computed = await computeReport({ workspaceId: session.workspace.id, permissions: session.permissions, role: session.membership.role, definition: report });
  recordReportComputationDuration(session.workspace.id, computed.totalDurationMs);
  const values = computed.widgets.flatMap((widget) => widget.values);
  const snapshot = createSnapshot({
    report_id: report.id,
    workspace_id: session.workspace.id,
    definition: report,
    values,
    comparison: computed.comparison,
    diagnostics: computed.diagnostics,
    source_timestamps: computed.sourceTimestamps,
    generated_by_member_id: session.membership.id,
  });
  recordTimelineActivity(session.workspace.id, "report", report.id, "report_snapshot_generated", `Snapshot generated for report "${report.title}"`);
  return { success: true, data: snapshot };
}

// --- Export preparation --------------------------------------------------------------

/**
 * v2.0 Checkpoint 42, Step 14 — the actual CSV/XLSX/PDF generation happens
 * entirely client-side (`modules/analytics/export/exportFormats.ts`, reused
 * unchanged); this action's only job is recording the `report_export_requested`
 * Timeline event once the client has confirmed the download was triggered —
 * never a server-side file generation or delivery path.
 */
export async function recordReportExportRequestedAction(id: string): Promise<DataResult<null>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const report = await getReport(session.workspace.id, id);
  if (!report) return { success: false, error: "Report not found." };
  recordTimelineActivity(session.workspace.id, "report", report.id, "report_export_requested", `Export requested for report "${report.title}"`);
  return { success: true, data: null };
}

// --- Reporting Health --------------------------------------------------------------

/**
 * Session-free — reused by the Executive Decisions integration (Step 11)
 * so that surface never has to fake or duplicate its own permission
 * resolution; a workspace-wide health read is legitimate for that internal
 * caller the same way every other platform's own
 * `evaluate*HealthActionForWorkspace()` helper already is (see
 * `notificationPlatformActions.ts`).
 */
async function evaluateReportingHealthForWorkspace(workspaceId: string): Promise<ReportingHealthReport> {
  const reports = await listReports(workspaceId, true);
  const snapshotsByReport = reports.map((r) => listSnapshots(workspaceId, r.id));
  const snapshots = snapshotsByReport.flat();
  const latestDiagnostics = snapshotsByReport.flatMap((s) => s[0]?.diagnostics ?? []);

  return computeReportingHealth({
    allMetrics: listReportMetrics(),
    templates: listReportTemplates(),
    reports,
    snapshots,
    latestDiagnostics,
    recentDurationsMs: getRecentReportComputationDurations(workspaceId),
    evaluatedAt: nowIso(),
  });
}

export async function evaluateReportingHealthAction(): Promise<DataResult<ReportingHealthReport>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: await evaluateReportingHealthForWorkspace(session.workspace.id) };
}

// --- Reporting Analytics -----------------------------------------------------------

export async function evaluateReportingAnalyticsAction(): Promise<DataResult<ReportingAnalytics>> {
  const session = await requireReportsPermission("reports.view");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const reports = await listReports(workspaceId, true);
  const snapshots = reports.flatMap((r) => listSnapshots(workspaceId, r.id));
  const favorites = readWorkspaceFavorites().filter((f) => f.workspace_id === workspaceId && f.entity_type === "report");
  const recentItems = readWorkspaceRecentItems().filter((r) => r.workspace_id === workspaceId && r.entity_type === "report");

  const analytics = computeReportingAnalytics({
    reports,
    snapshots,
    favorites,
    recentItems,
    recentDurationsMs: getRecentReportComputationDurations(workspaceId),
    evaluatedAt: nowIso(),
  });
  return { success: true, data: analytics };
}

// --- Executive Reporting extension --------------------------------------------------

/**
 * v2.0 Checkpoint 42, Step 16 — exposes Executive Decisions' own already-
 * computed `ExecutiveReport` (`evaluateExecutiveDecisionsAction()`,
 * Checkpoint 25.7) as `ReportInsight[]` for the "Critical Risks" and
 * "Recent Improvements" named executive views this checkpoint's spec
 * calls for. Never a second insights engine — every entry here is a
 * direct, honest re-labeling of a field that engine already produced.
 * `ExecutiveReport` has no "Opportunities" or "Recent Regressions" field
 * (only `criticalIssues`/`businessRisks`/`operationalRisks`/
 * `topImprovements` exist) — those two named views are deliberately
 * absent from the result rather than fabricated; see `docs/reporting-ui.md`.
 */
export async function getExecutiveReportInsightsAction(): Promise<DataResult<ReportInsight[]>> {
  const session = await requireReportsPermission("reports.executive");
  if (!session) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await evaluateExecutiveDecisionsAction();
  if (!result.success) return { success: false, error: result.error };

  const { report } = result.data;
  const insights: ReportInsight[] = [
    ...report.criticalIssues.map((message, index) => ({ id: `critical_${index}`, label: "Critical Issue", message, severity: "critical" as const, relatedMetricId: "executive.overall_score" })),
    ...report.businessRisks.map((message, index) => ({ id: `business_risk_${index}`, label: "Business Risk", message, severity: "warning" as const, relatedMetricId: "executive.business_health_finance_crm" })),
    ...report.operationalRisks.map((message, index) => ({ id: `operational_risk_${index}`, label: "Operational Risk", message, severity: "warning" as const, relatedMetricId: "executive.business_health_knowledge_graph" })),
    ...report.topImprovements.map((message, index) => ({ id: `improvement_${index}`, label: "Recent Improvement", message, severity: "positive" as const, relatedMetricId: null })),
  ];
  return { success: true, data: insights };
}
