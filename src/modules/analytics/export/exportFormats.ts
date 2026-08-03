"use client";

/**
 * v2 Checkpoint 23, Step 15 — Export Center. Every format here is generated
 * entirely client-side from data already on screen (no new Server Action,
 * no data ever leaves the browser except to the user's own downloads
 * folder) — CSV needs no library at all; Excel uses `exceljs` (actively
 * maintained, write-only usage here so its own parser surface, where most
 * spreadsheet-library CVEs live, is never exercised); PDF uses `jspdf`.
 * Deliberately not the `xlsx` (SheetJS) package — its npm-published
 * releases carry known, currently-unpatched high-severity prototype-
 * pollution/ReDoS advisories.
 */

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Pure — builds RFC 4180-ish CSV text. The one export function cheap and meaningful to unit test directly; the download triggers below are thin, untestable browser side effects wrapped around it. */
export function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return lines.join("\r\n");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const blob = new Blob([rowsToCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

export async function downloadXlsx(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]): Promise<void> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.columns.forEach((column) => {
    column.width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

export interface PdfReportSection {
  heading: string;
  lines: string[];
}

/** A plain, print-ready text report — deliberately simple typography (no charts/images) since this is a summary document meant to be read or printed, not a pixel-perfect brand asset. */
export async function downloadExecutiveSummaryPdf(filename: string, title: string, sections: PdfReportSection[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(new Date().toLocaleString(), marginX, y);
  doc.setTextColor(0);
  y += 24;

  for (const section of sections) {
    if (y > 720) {
      doc.addPage();
      y = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(section.heading, marginX, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of section.lines) {
      if (y > 740) {
        doc.addPage();
        y = 56;
      }
      doc.text(line, marginX, y);
      y += 14;
    }
    y += 10;
  }

  doc.save(filename);
}
