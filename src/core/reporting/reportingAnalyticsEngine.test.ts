import { describe, expect, it } from "vitest";
import { computeReportingAnalytics } from "@/core/reporting/reportingAnalyticsEngine";
import type { ReportSnapshot, SavedReport } from "@/types/reporting";
import type { WorkspaceFavorite, WorkspaceRecentItem } from "@/types/smartWorkspace";

function makeReport(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: "report_1",
    workspace_id: "ws_1",
    created_by_member_id: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    source_template_id: null,
    title: "Revenue Report",
    description: "",
    category: "finance",
    sections: [{ id: "s1", title: "Section", chartType: "kpi", metricIds: ["revenue.total"], notes: null }],
    periodKey: "30d",
    customWindow: null,
    comparisonMode: "previous_period",
    customComparisonWindow: null,
    groupBy: null,
    sortBy: null,
    filters: [{ key: "status", value: "active" }],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ReportSnapshot> = {}): ReportSnapshot {
  return {
    id: "snap_1",
    report_id: "report_1",
    workspace_id: "ws_1",
    definition: makeReport(),
    values: [],
    comparison: { mode: "none", currentWindow: { start: "", end: "" }, comparisonWindow: null, comparable: false, missingPeriodReason: null },
    diagnostics: [],
    source_timestamps: {},
    generated_at: "2026-01-02T00:00:00.000Z",
    generated_by_member_id: "member_1",
    ...overrides,
  };
}

function baseInput() {
  return {
    reports: [] as SavedReport[],
    snapshots: [] as ReportSnapshot[],
    favorites: [] as WorkspaceFavorite[],
    recentItems: [] as WorkspaceRecentItem[],
    recentDurationsMs: [] as number[],
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("core/reporting/reportingAnalyticsEngine", () => {
  it("splits reportsCreated into reportsSaved (from-scratch) vs templatesUsed", () => {
    const analytics = computeReportingAnalytics({ ...baseInput(), reports: [makeReport({ id: "a", source_template_id: null }), makeReport({ id: "b", source_template_id: "template_1" })] });
    expect(analytics.reportsCreated).toBe(2);
    expect(analytics.reportsSaved).toBe(1);
    expect(analytics.templatesUsed).toBe(1);
  });

  it("counts favorites and pinned separately from the generic Favorites store", () => {
    const favorites: WorkspaceFavorite[] = [
      { id: "f1", workspace_id: "ws_1", member_id: "m1", entity_type: "report", entity_id: "report_1", label: "R", href: "/reports/report_1", created_at: "2026-01-01T00:00:00.000Z", pinned: true },
      { id: "f2", workspace_id: "ws_1", member_id: "m1", entity_type: "report", entity_id: "report_2", label: "R2", href: "/reports/report_2", created_at: "2026-01-01T00:00:00.000Z", pinned: false },
    ];
    const analytics = computeReportingAnalytics({ ...baseInput(), favorites });
    expect(analytics.reportsFavorited).toBe(2);
    expect(analytics.reportsPinned).toBe(1);
  });

  it("counts snapshotsGenerated from the snapshots list", () => {
    const analytics = computeReportingAnalytics({ ...baseInput(), snapshots: [makeSnapshot({ id: "s1" }), makeSnapshot({ id: "s2" })] });
    expect(analytics.snapshotsGenerated).toBe(2);
  });

  it("counts reportsViewed from Recent Items' own action:'view' entries, and ranks mostViewedReports by count", () => {
    const reports = [makeReport({ id: "r1", title: "Revenue Report" })];
    const recentItems: WorkspaceRecentItem[] = [
      { id: "ri1", workspace_id: "ws_1", member_id: "m1", entity_type: "report", entity_id: "r1", label: "Revenue Report", href: "/reports/r1", viewed_at: "2026-01-01T00:00:00.000Z", visit_count: 1, action: "view" },
      { id: "ri2", workspace_id: "ws_1", member_id: "m1", entity_type: "report", entity_id: "r1", label: "Revenue Report", href: "/reports/r1", viewed_at: "2026-01-02T00:00:00.000Z", visit_count: 2, action: "view" },
      { id: "ri3", workspace_id: "ws_1", member_id: "m1", entity_type: "report", entity_id: "r1", label: "Revenue Report", href: "/reports/r1", viewed_at: "2026-01-01T00:00:00.000Z", visit_count: 1, action: "edit" },
    ];
    const analytics = computeReportingAnalytics({ ...baseInput(), reports, recentItems });
    expect(analytics.reportsViewed).toBe(2);
    expect(analytics.mostViewedReports).toEqual([{ key: "r1", label: "Revenue Report", count: 2 }]);
  });

  it("tallies mostUsedMetrics from every report's own section metricIds", () => {
    const reports = [makeReport({ id: "a", sections: [{ id: "s1", title: "S", chartType: "kpi", metricIds: ["revenue.total", "revenue.total"], notes: null }] })];
    const analytics = computeReportingAnalytics({ ...baseInput(), reports });
    expect(analytics.mostUsedMetrics).toEqual([{ key: "revenue.total", label: "revenue.total", count: 2 }]);
  });

  it("tallies mostUsedFilters from every report's own filters", () => {
    const reports = [makeReport({ id: "a", filters: [{ key: "status", value: "active" }] }), makeReport({ id: "b", filters: [{ key: "status", value: "closed" }] })];
    const analytics = computeReportingAnalytics({ ...baseInput(), reports });
    expect(analytics.mostUsedFilters).toEqual([{ key: "status", label: "status", count: 2 }]);
  });

  it("counts noDataReports and failedReportSources from the latest snapshot's own diagnostics", () => {
    const allUnavailable = makeSnapshot({ id: "s1", report_id: "r1", diagnostics: [{ metricId: "m1", status: "unavailable", message: null }] });
    const partial = makeSnapshot({ id: "s2", report_id: "r2", diagnostics: [{ metricId: "m2", status: "ok", message: null }, { metricId: "m3", status: "unavailable", message: null }] });
    const analytics = computeReportingAnalytics({ ...baseInput(), snapshots: [allUnavailable, partial] });
    expect(analytics.noDataReports).toBe(1);
    expect(analytics.failedReportSources).toBe(2);
  });

  it("uses only the latest snapshot per report for noDataReports/failedReportSources", () => {
    const older = makeSnapshot({ id: "s1", report_id: "r1", generated_at: "2026-01-01T00:00:00.000Z", diagnostics: [{ metricId: "m1", status: "unavailable", message: null }] });
    const newer = makeSnapshot({ id: "s2", report_id: "r1", generated_at: "2026-01-02T00:00:00.000Z", diagnostics: [{ metricId: "m1", status: "ok", message: null }] });
    const analytics = computeReportingAnalytics({ ...baseInput(), snapshots: [older, newer] });
    expect(analytics.noDataReports).toBe(0);
    expect(analytics.failedReportSources).toBe(0);
  });

  it("averages recentDurationsMs into averageGenerationTimeMs, or null when empty", () => {
    expect(computeReportingAnalytics(baseInput()).averageGenerationTimeMs).toBeNull();
    expect(computeReportingAnalytics({ ...baseInput(), recentDurationsMs: [100, 200] }).averageGenerationTimeMs).toBe(150);
  });
});
