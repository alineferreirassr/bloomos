import type { ReportSnapshot, SavedReport } from "@/types/reporting";
import type { WorkspaceFavorite, WorkspaceRecentItem } from "@/types/smartWorkspace";
import type { ReportingAnalytics, ReportingUsageRanking } from "@/types/reportingAnalytics";

/**
 * v2.0 Checkpoint 42, Step 10 — internal Reporting Platform usage
 * analytics. Pure — every count here is derived from data the caller
 * already fetched (the workspace's own reports/snapshots, and the
 * already-generic Favorites/Recent Items stores from Checkpoint 38 filtered
 * to `entity_type: "report"`), never a second favorites/recents/view-
 * tracking concept of its own. `mostViewedReports`'s "viewed" count reuses
 * the Recent Items store's own `action: "view"` entries — there is
 * deliberately no separate Reporting-specific view counter.
 */

function latestSnapshotPerReport(snapshots: ReportSnapshot[]): Map<string, ReportSnapshot> {
  const byReport = new Map<string, ReportSnapshot>();
  for (const snapshot of snapshots) {
    const existing = byReport.get(snapshot.report_id);
    if (!existing || snapshot.generated_at > existing.generated_at) byReport.set(snapshot.report_id, snapshot);
  }
  return byReport;
}

function topRankings(counts: Map<string, number>, labels: Map<string, string>, limit = 5): ReportingUsageRanking[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, label: labels.get(key) ?? key, count }));
}

export interface ComputeReportingAnalyticsInput {
  /** All of the workspace's own reports, including archived — "created" is a lifetime count. */
  reports: SavedReport[];
  /** All of the workspace's own snapshots, across every report. */
  snapshots: ReportSnapshot[];
  /** Pre-filtered to this workspace and `entity_type: "report"`. */
  favorites: WorkspaceFavorite[];
  /** Pre-filtered to this workspace and `entity_type: "report"`. */
  recentItems: WorkspaceRecentItem[];
  /** Real, measured `computeReport()` durations (`performanceSamplesStore.ts`) — never a fabricated benchmark. */
  recentDurationsMs: number[];
  evaluatedAt: string;
}

export function computeReportingAnalytics(input: ComputeReportingAnalyticsInput): ReportingAnalytics {
  const { reports, snapshots, favorites, recentItems, recentDurationsMs, evaluatedAt } = input;

  const reportsCreated = reports.length;
  /** A report saved from scratch in the Builder, as distinct from one instantiated from a template — see `templatesUsed` below for that other half of the same split. */
  const reportsSaved = reports.filter((r) => r.source_template_id === null).length;
  const templatesUsed = reports.filter((r) => r.source_template_id !== null).length;
  const reportsFavorited = favorites.length;
  const reportsPinned = favorites.filter((f) => f.pinned).length;
  const snapshotsGenerated = snapshots.length;

  const views = recentItems.filter((r) => r.action === "view");
  const reportsViewed = views.length;
  const reportLabels = new Map(reports.map((r) => [r.id, r.title]));
  const viewCounts = new Map<string, number>();
  for (const view of views) viewCounts.set(view.entity_id, (viewCounts.get(view.entity_id) ?? 0) + 1);
  const mostViewedReports = topRankings(viewCounts, reportLabels);

  const metricCounts = new Map<string, number>();
  for (const report of reports) for (const section of report.sections) for (const metricId of section.metricIds) metricCounts.set(metricId, (metricCounts.get(metricId) ?? 0) + 1);
  const mostUsedMetrics = topRankings(metricCounts, new Map());

  const filterCounts = new Map<string, number>();
  for (const report of reports) for (const filter of report.filters) filterCounts.set(filter.key, (filterCounts.get(filter.key) ?? 0) + 1);
  const mostUsedFilters = topRankings(filterCounts, new Map());

  const latestByReport = latestSnapshotPerReport(snapshots);
  let noDataReports = 0;
  let failedReportSources = 0;
  for (const snapshot of latestByReport.values()) {
    const unavailable = snapshot.diagnostics.filter((d) => d.status === "unavailable");
    failedReportSources += unavailable.length;
    if (snapshot.diagnostics.length > 0 && unavailable.length === snapshot.diagnostics.length) noDataReports += 1;
  }

  const averageGenerationTimeMs = recentDurationsMs.length === 0 ? null : Math.round(recentDurationsMs.reduce((sum, d) => sum + d, 0) / recentDurationsMs.length);

  return {
    reportsCreated,
    reportsViewed,
    reportsSaved,
    reportsFavorited,
    reportsPinned,
    templatesUsed,
    snapshotsGenerated,
    mostViewedReports,
    mostUsedMetrics,
    mostUsedFilters,
    noDataReports,
    failedReportSources,
    averageGenerationTimeMs,
    evaluatedAt,
  };
}
