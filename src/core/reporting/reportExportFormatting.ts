import type { PdfReportSection } from "@/modules/analytics/export/exportFormats";
import type { ComputedReport } from "@/core/reporting/computationEngine";
import type { SavedReport } from "@/types/reporting";

/**
 * v2.0 Checkpoint 42, Step 14 — Export preparation. Pure data-shaping only;
 * the actual CSV/XLSX/PDF generation reuses
 * `modules/analytics/export/exportFormats.ts` (Checkpoint 23's already-real,
 * entirely client-side export utility) directly — this file's only job is
 * turning a `ComputedReport` into the generic `headers/rows`/
 * `PdfReportSection[]` shapes that utility already accepts, never a second
 * export engine.
 */

export const REPORT_EXPORT_HEADERS = ["Section", "Metric", "Value", "Unit", "Previous Value", "Change %", "Trend", "Status"] as const;

export function buildReportExportRows(computed: ComputedReport): (string | number)[][] {
  return computed.widgets.flatMap((widget) =>
    widget.values.map((value) => [
      widget.section.title,
      value.label,
      value.value ?? "N/A",
      value.unit,
      value.previousValue ?? "N/A",
      value.changePercent === null ? "N/A" : value.changePercent,
      value.trend,
      value.notApplicableReason ?? "OK",
    ]),
  );
}

export function buildReportExportFilename(report: SavedReport, extension: string): string {
  const slug = report.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${slug || "report"}.${extension}`;
}

export function buildReportPdfSections(computed: ComputedReport): PdfReportSection[] {
  return computed.widgets.map((widget) => ({
    heading: widget.section.title,
    lines:
      widget.values.length === 0
        ? ["No data available for this section."]
        : widget.values.map((value) => {
            const changePart = value.changePercent === null ? "" : ` (${value.changePercent >= 0 ? "+" : ""}${value.changePercent.toFixed(1)}%)`;
            const valuePart = value.value === null ? value.notApplicableReason ?? "N/A" : `${value.value} ${value.unit}`;
            return `${value.label}: ${valuePart}${changePart}`;
          }),
  }));
}
