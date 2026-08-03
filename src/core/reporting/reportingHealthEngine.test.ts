import { describe, expect, it } from "vitest";
import { computeReportingHealth } from "@/core/reporting/reportingHealthEngine";
import type { ReportMetricDefinition } from "@/types/reportMetric";
import type { ReportSnapshot, ReportSourceDiagnostic, ReportTemplate, SavedReport } from "@/types/reporting";

function makeMetric(overrides: Partial<ReportMetricDefinition> = {}): ReportMetricDefinition {
  return {
    id: "m",
    name: "Metric",
    description: "",
    category: "custom",
    unit: "count",
    aggregation: "sum",
    sourceModule: "Test",
    sourceEngine: "test()",
    supportedDimensions: [],
    supportedFilters: [],
    freshness: "realtime",
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    knownLimitations: [],
    compute: async () => ({ value: 1, previousValue: null, unit: "count", series: [], breakdown: [], notApplicableReason: null, stale: false, partial: false }),
    ...overrides,
  };
}

function baseInput() {
  return {
    allMetrics: [] as ReportMetricDefinition[],
    templates: [] as ReportTemplate[],
    reports: [] as SavedReport[],
    snapshots: [] as ReportSnapshot[],
    latestDiagnostics: [] as ReportSourceDiagnostic[],
    recentDurationsMs: [] as number[],
    evaluatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("core/reporting/reportingHealthEngine", () => {
  it("scores metric_coverage from the categories with at least one registered metric", () => {
    const report = computeReportingHealth({ ...baseInput(), allMetrics: [makeMetric({ category: "finance" })] });
    const category = report.categories.find((c) => c.category === "metric_coverage")!;
    expect(category.score).toBeGreaterThan(0);
    expect(category.score).toBeLessThan(100);
  });

  it("marks source_availability/source_freshness as not applicable when no snapshots exist yet", () => {
    const report = computeReportingHealth(baseInput());
    expect(report.categories.find((c) => c.category === "source_availability")!.notApplicableReason).toBeTruthy();
    expect(report.categories.find((c) => c.category === "source_freshness")!.notApplicableReason).toBeTruthy();
  });

  it("scores source_availability down when the latest diagnostics show an unavailable source", () => {
    const report = computeReportingHealth({ ...baseInput(), latestDiagnostics: [{ metricId: "a", status: "unavailable", message: null }, { metricId: "b", status: "ok", message: null }] });
    expect(report.categories.find((c) => c.category === "source_availability")!.score).toBe(50);
  });

  it("scores source_freshness down when the latest diagnostics show a stale source", () => {
    const report = computeReportingHealth({ ...baseInput(), latestDiagnostics: [{ metricId: "a", status: "stale", message: null }] });
    expect(report.categories.find((c) => c.category === "source_freshness")!.score).toBe(0);
  });

  it("marks permission_configuration not applicable when no finance/executive metrics are registered", () => {
    const report = computeReportingHealth({ ...baseInput(), allMetrics: [makeMetric({ category: "custom" })] });
    expect(report.categories.find((c) => c.category === "permission_configuration")!.notApplicableReason).toBeTruthy();
  });

  it("flags an ungated finance metric in permission_configuration", () => {
    const report = computeReportingHealth({ ...baseInput(), allMetrics: [makeMetric({ id: "revenue", category: "finance", requiredPermissions: [] })] });
    const category = report.categories.find((c) => c.category === "permission_configuration")!;
    expect(category.score).toBe(0);
    expect(category.issues[0]).toContain("revenue");
  });

  it("scores permission_configuration 100 when every finance/executive metric is gated", () => {
    const report = computeReportingHealth({ ...baseInput(), allMetrics: [makeMetric({ id: "revenue", category: "finance", requiredPermissions: ["reports.financial"] })] });
    expect(report.categories.find((c) => c.category === "permission_configuration")!.score).toBe(100);
  });

  it("flags snapshot_integrity when a snapshot references a report that no longer exists", () => {
    const orphan: ReportSnapshot = {
      id: "snap_1",
      report_id: "missing_report",
      workspace_id: "ws_1",
      definition: { title: "T", description: "", category: "custom", sections: [], periodKey: "30d", customWindow: null, comparisonMode: "none", customComparisonWindow: null, groupBy: null, sortBy: null, filters: [] },
      values: [],
      comparison: { mode: "none", currentWindow: { start: "", end: "" }, comparisonWindow: null, comparable: false, missingPeriodReason: null },
      diagnostics: [],
      source_timestamps: {},
      generated_at: "2026-01-01T00:00:00.000Z",
      generated_by_member_id: "member_1",
    };
    const report = computeReportingHealth({ ...baseInput(), snapshots: [orphan] });
    const category = report.categories.find((c) => c.category === "snapshot_integrity")!;
    expect(category.score).toBe(0);
  });

  it("marks performance not applicable when no computations have been timed", () => {
    const report = computeReportingHealth(baseInput());
    expect(report.categories.find((c) => c.category === "performance")!.notApplicableReason).toBeTruthy();
  });

  it("scores performance 100 for fast average durations and lower for slow ones", () => {
    const fast = computeReportingHealth({ ...baseInput(), recentDurationsMs: [100, 150] });
    const slow = computeReportingHealth({ ...baseInput(), recentDurationsMs: [6000, 7000] });
    expect(fast.categories.find((c) => c.category === "performance")!.score).toBe(100);
    expect(slow.categories.find((c) => c.category === "performance")!.score).toBeLessThan(100);
  });

  it("averages only the categories that have a real score into overallScore", () => {
    const report = computeReportingHealth(baseInput());
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it("produces a finding for every issue, with severity derived from the category score", () => {
    const report = computeReportingHealth({ ...baseInput(), allMetrics: [makeMetric({ id: "revenue", category: "finance", requiredPermissions: [] })] });
    const finding = report.findings.find((f) => f.ruleId === "reporting_health_permission_configuration");
    expect(finding?.severity).toBe("critical");
  });
});
