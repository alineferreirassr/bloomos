"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { downloadCsv, downloadXlsx, downloadExecutiveSummaryPdf, type PdfReportSection } from "@/modules/analytics/export/exportFormats";

export interface ExportMenuProps {
  /** Base filename, no extension — reused across CSV/Excel/PDF with the right extension appended. */
  filenameBase: string;
  sheetName: string;
  headers: string[];
  rows: (string | number)[][];
  /** When provided, also offers a "Print-Ready PDF" export of these sections (an executive summary), in addition to the tabular CSV/Excel export every panel gets. */
  pdfTitle?: string;
  pdfSections?: PdfReportSection[];
}

/** v2 Checkpoint 23, Step 15 — Export Center. One reusable control every analytics panel wires up over its own already-computed rows, rather than each panel re-implementing CSV/Excel/PDF generation. */
export function ExportMenu({ filenameBase, sheetName, headers, rows, pdfTitle, pdfSections }: ExportMenuProps) {
  const [busy, setBusy] = useState<string | null>(null);

  async function withBusy(key: string, action: () => void | Promise<void>) {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={busy !== null} onClick={() => withBusy("csv", () => downloadCsv(`${filenameBase}.csv`, headers, rows))}>
        {busy === "csv" ? "Exporting…" : "Export CSV"}
      </Button>
      <Button variant="secondary" disabled={busy !== null} onClick={() => withBusy("xlsx", () => downloadXlsx(`${filenameBase}.xlsx`, sheetName, headers, rows))}>
        {busy === "xlsx" ? "Exporting…" : "Export Excel"}
      </Button>
      {pdfSections ? (
        <Button variant="secondary" disabled={busy !== null} onClick={() => withBusy("pdf", () => downloadExecutiveSummaryPdf(`${filenameBase}.pdf`, pdfTitle ?? filenameBase, pdfSections))}>
          {busy === "pdf" ? "Exporting…" : "Export PDF"}
        </Button>
      ) : null}
    </div>
  );
}
