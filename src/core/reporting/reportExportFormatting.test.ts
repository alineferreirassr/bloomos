import { describe, expect, it } from "vitest";
import { buildReportExportRows, buildReportExportFilename, buildReportPdfSections, REPORT_EXPORT_HEADERS } from "@/core/reporting/reportExportFormatting";
import type { ComputedReport } from "@/core/reporting/computationEngine";
import type { SavedReport, ReportMetricValue } from "@/types/reporting";

function makeValue(overrides: Partial<ReportMetricValue> = {}): ReportMetricValue {
  return {
    metricId: "m1",
    label: "Revenue",
    unit: "currency",
    value: 1000,
    previousValue: 900,
    changePercent: 11.1,
    trend: "up",
    series: [],
    breakdown: [],
    notApplicableReason: null,
    ...overrides,
  };
}

function makeComputed(values: ReportMetricValue[]): ComputedReport {
  return {
    widgets: [{ section: { id: "s1", title: "Overview", chartType: "kpi", metricIds: values.map((v) => v.metricId), notes: null }, values }],
    comparison: { mode: "previous_period", currentWindow: { start: "", end: "" }, comparisonWindow: { start: "", end: "" }, comparable: true, missingPeriodReason: null },
    diagnostics: [],
    sourceTimestamps: {},
    totalDurationMs: 10,
  };
}

function makeReport(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: "report_1",
    workspace_id: "ws_1",
    created_by_member_id: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    source_template_id: null,
    title: "Q1 Revenue Report!",
    description: "",
    category: "finance",
    sections: [],
    periodKey: "30d",
    customWindow: null,
    comparisonMode: "previous_period",
    customComparisonWindow: null,
    groupBy: null,
    sortBy: null,
    filters: [],
    ...overrides,
  };
}

describe("core/reporting/reportExportFormatting", () => {
  it("builds one row per metric value with the full header set", () => {
    expect(REPORT_EXPORT_HEADERS).toEqual(["Section", "Metric", "Value", "Unit", "Previous Value", "Change %", "Trend", "Status"]);
    const rows = buildReportExportRows(makeComputed([makeValue()]));
    expect(rows).toEqual([["Overview", "Revenue", 1000, "currency", 900, 11.1, "up", "OK"]]);
  });

  it("renders a null value as 'N/A' rather than a fabricated number", () => {
    const rows = buildReportExportRows(makeComputed([makeValue({ value: null, previousValue: null, changePercent: null })]));
    expect(rows[0]![2]).toBe("N/A");
    expect(rows[0]![4]).toBe("N/A");
    expect(rows[0]![5]).toBe("N/A");
  });

  it("surfaces notApplicableReason in the Status column instead of 'OK'", () => {
    const rows = buildReportExportRows(makeComputed([makeValue({ value: null, notApplicableReason: "No data yet." })]));
    expect(rows[0]![7]).toBe("No data yet.");
  });

  it("slugifies the report title into a filesystem-safe filename with the given extension", () => {
    expect(buildReportExportFilename(makeReport({ title: "Q1 Revenue Report!" }), "csv")).toBe("q1-revenue-report.csv");
  });

  it("falls back to 'report' when the title slugifies to nothing", () => {
    expect(buildReportExportFilename(makeReport({ title: "!!!" }), "pdf")).toBe("report.pdf");
  });

  it("builds one PDF section per widget, with a line per metric value", () => {
    const sections = buildReportPdfSections(makeComputed([makeValue()]));
    expect(sections).toEqual([{ heading: "Overview", lines: ["Revenue: 1000 currency (+11.1%)"] }]);
  });

  it("describes an empty section honestly rather than an empty PDF block", () => {
    const sections = buildReportPdfSections(makeComputed([]));
    expect(sections[0]!.lines).toEqual(["No data available for this section."]);
  });
});
