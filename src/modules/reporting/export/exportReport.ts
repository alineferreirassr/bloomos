"use client";

import { downloadCsv, downloadXlsx, downloadExecutiveSummaryPdf } from "@/modules/analytics/export/exportFormats";
import { buildReportExportRows, buildReportExportFilename, buildReportPdfSections, REPORT_EXPORT_HEADERS } from "@/core/reporting/reportExportFormatting";
import { recordReportExportRequestedAction } from "@/modules/reporting/reportingActions";
import type { ComputedReport } from "@/core/reporting/computationEngine";
import type { SavedReport, ReportExportFormat } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42, Step 14 — the Reporting Center's one export entry
 * point. Wraps the already-real `exportFormats.ts` utility with report-
 * specific data shaping and the `report_export_requested` Timeline event;
 * `"print"` reuses the browser's own `window.print()` rather than a fourth
 * generated-file format.
 */
export async function exportReport(format: ReportExportFormat, report: SavedReport, computed: ComputedReport): Promise<void> {
  const rows = buildReportExportRows(computed);

  if (format === "csv") {
    downloadCsv(buildReportExportFilename(report, "csv"), [...REPORT_EXPORT_HEADERS], rows);
  } else if (format === "xlsx") {
    await downloadXlsx(buildReportExportFilename(report, "xlsx"), report.title.slice(0, 31) || "Report", [...REPORT_EXPORT_HEADERS], rows);
  } else if (format === "pdf") {
    await downloadExecutiveSummaryPdf(buildReportExportFilename(report, "pdf"), report.title, buildReportPdfSections(computed));
  } else {
    window.print();
  }

  await recordReportExportRequestedAction(report.id);
}
