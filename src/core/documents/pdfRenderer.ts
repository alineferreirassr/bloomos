import type { DocumentBlock, TextRun } from "@/types/documentPlatform";
import type { DocumentBrandTheme } from "@/core/branding/applyBrandingToDocument";

/**
 * v2 Checkpoint 44, Step 3 — the one Shared PDF Renderer this checkpoint's
 * own instructions call for ("Reuse existing PDF infrastructure. If none
 * exists: create one shared rendering pipeline. Never create separate PDF
 * generators."). The Step 0 audit confirmed no PDF renderer existed
 * anywhere in the codebase — `jspdf` was a dependency used only for
 * Analytics' own client-side CSV/PDF export (`modules/analytics/export/exportFormats.ts`),
 * a different concern (a summary report of on-screen numbers, not a
 * compiled Document's own block tree). This is the first, and must stay
 * the only, renderer for a `ComposedDocument`'s own `content` — every
 * future Bundle/Guide/Proposal/Contract/Invoice PDF calls this function,
 * never a second `new jsPDF()` call site.
 *
 * Consumes exactly the same `DocumentBlock[]` shape
 * `core/documents/exportPlainText.ts` already walks — this is a second,
 * richer *rendering* of that same compiled tree, not a competing document
 * model. `exportPlainText.ts` itself is untouched; plain-text stays a
 * valid, separate export format alongside this one.
 */

const PAGE_WIDTH_PT = 612; // US Letter, 8.5in * 72pt
const PAGE_HEIGHT_PT = 792; // 11in * 72pt
const MARGIN_X = 54;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 72;
const CONTENT_BOTTOM = PAGE_HEIGHT_PT - MARGIN_BOTTOM;

export type PdfRenderMode = "preview" | "print";

export interface PdfRenderOptions {
  documentTitle: string;
  brandTheme: DocumentBrandTheme;
  headerBlocks?: DocumentBlock[];
  footerBlocks?: DocumentBlock[];
  /** "preview" shows a diagonal "PREVIEW" watermark automatically (in addition to any `watermarkText`); "print" never does. */
  mode: PdfRenderMode;
  /** An explicit watermark (e.g. "DRAFT", "VOID") — shown in both modes when set. */
  watermarkText?: string | null;
  /** Defaults to true — "Page X of Y" in the footer. */
  pageNumbering?: boolean;
  /** File names listed as an appendix on the final page — the PDF's own record of what else accompanies it, since the PDF itself can't embed arbitrary binary attachments. */
  attachmentNames?: string[];
  /** A signature image (data URL) placed inline wherever a `type: "image"` block's own `alt` text is exactly `"signature"` — the Contract Platform's own signing flow (Step 9) supplies this once a signature is captured. */
  signatureImageDataUrl?: string | null;
}

function runsText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value) || full.length !== 6) return [0, 0, 0];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Renders a compiled Document's own block tree to a real PDF binary.
 * Returns the raw bytes — callers decide whether to stream them (an API
 * route), attach them (an email send), or store them (a Bundle). Never
 * touches `document`/`window` — this runs equally in a server action or a
 * client component, matching this platform's own "compile once, render
 * anywhere" goal.
 */
export async function renderDocumentToPdf(content: DocumentBlock[], options: PdfRenderOptions): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const [primaryR, primaryG, primaryB] = hexToRgb(options.brandTheme.primaryColor);
  const pageNumbering = options.pageNumbering ?? true;
  const headerBlocks = options.headerBlocks ?? [];
  const footerBlocks = options.footerBlocks ?? [];

  let y = MARGIN_TOP;

  function drawHeaderAndLogo(): void {
    if (options.brandTheme.logoUrl) {
      // jsPDF can only embed an image it can decode synchronously from a data URL;
      // an external `logoUrl` (the common case — a Settings-configured file URL)
      // is intentionally not fetched here. Callers that need the real logo
      // pixel-embedded pass a pre-resolved data URL as the first header block's
      // own image instead — this keeps the renderer itself free of network calls.
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryR, primaryG, primaryB);
    doc.setFontSize(10);
    doc.text(options.brandTheme.brandName, MARGIN_X, 36);
    doc.setDrawColor(primaryR, primaryG, primaryB);
    doc.setLineWidth(1);
    doc.line(MARGIN_X, 42, PAGE_WIDTH_PT - MARGIN_X, 42);
    doc.setTextColor(0, 0, 0);
  }

  function drawFooter(): void {
    const footerY = PAGE_HEIGHT_PT - 40;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_X, footerY - 10, PAGE_WIDTH_PT - MARGIN_X, footerY - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    let line = footerY;
    for (const text of options.brandTheme.footerLines) {
      doc.text(text, MARGIN_X, line);
      line += 10;
    }
    if (options.brandTheme.legalLine) doc.text(options.brandTheme.legalLine, MARGIN_X, line);
    doc.setTextColor(0, 0, 0);
  }

  function drawWatermark(): void {
    const text = options.watermarkText ?? (options.mode === "preview" ? "PREVIEW" : null);
    if (!text) return;
    doc.saveGraphicsState();
    doc.setFontSize(72);
    doc.setTextColor(220, 220, 220);
    const gState = (doc as unknown as { GState: new (params: { opacity: number }) => unknown }).GState;
    if (gState) doc.setGState(new gState({ opacity: 0.25 }) as never);
    doc.text(text, PAGE_WIDTH_PT / 2, PAGE_HEIGHT_PT / 2, { align: "center", angle: 45 });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  function newPage(): void {
    doc.addPage();
    drawWatermark();
    drawHeaderAndLogo();
    drawFooter();
    y = MARGIN_TOP;
  }

  function ensureSpace(neededHeight: number): void {
    if (y + neededHeight > CONTENT_BOTTOM) newPage();
  }

  function setRunStyle(run: TextRun): void {
    const style = run.bold && run.italic ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
    doc.setFont("helvetica", style);
  }

  function visit(block: DocumentBlock): void {
    switch (block.type) {
      case "heading": {
        const size = block.level === 1 ? 18 : block.level === 2 ? 14 : 12;
        ensureSpace(size + 8);
        doc.setFontSize(size);
        doc.setTextColor(primaryR, primaryG, primaryB);
        for (const run of block.runs) setRunStyle(run);
        doc.setFont("helvetica", "bold");
        doc.text(runsText(block.runs), MARGIN_X, y);
        doc.setTextColor(0, 0, 0);
        y += size + 10;
        break;
      }
      case "paragraph": {
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "normal");
        const text = runsText(block.runs);
        const lines: string[] = doc.splitTextToSize(text, PAGE_WIDTH_PT - MARGIN_X * 2);
        for (const line of lines) {
          ensureSpace(14);
          doc.text(line, MARGIN_X, y);
          y += 14;
        }
        y += 6;
        break;
      }
      case "table": {
        doc.setFontSize(9.5);
        for (const row of block.rows) {
          ensureSpace(16);
          const cellWidth = (PAGE_WIDTH_PT - MARGIN_X * 2) / Math.max(row.length, 1);
          row.forEach((cell, index) => {
            doc.text(runsText(cell), MARGIN_X + index * cellWidth, y);
          });
          y += 16;
        }
        y += 6;
        break;
      }
      case "image": {
        const isSignature = block.alt?.toLowerCase() === "signature";
        const src = isSignature && options.signatureImageDataUrl ? options.signatureImageDataUrl : block.src;
        ensureSpace(80);
        if (src.startsWith("data:image")) {
          try {
            doc.addImage(src, "PNG", MARGIN_X, y, 160, 60);
          } catch {
            doc.setFontSize(9);
            doc.text(`[Image: ${block.alt || "unavailable"}]`, MARGIN_X, y + 10);
          }
        } else {
          doc.setFontSize(9);
          doc.setTextColor(140, 140, 140);
          doc.text(`[Image: ${block.alt || src}]`, MARGIN_X, y + 10);
          doc.setTextColor(0, 0, 0);
        }
        y += 70;
        break;
      }
      case "pageBreak":
        newPage();
        break;
      case "divider":
        ensureSpace(12);
        doc.setDrawColor(200, 200, 200);
        doc.line(MARGIN_X, y, PAGE_WIDTH_PT - MARGIN_X, y);
        y += 14;
        break;
      case "conditional":
        for (const child of block.blocks) visit(child);
        break;
      case "loop":
        for (const child of block.itemBlocks) visit(child);
        break;
    }
  }

  drawWatermark();
  drawHeaderAndLogo();
  drawFooter();
  for (const block of headerBlocks) visit(block);
  for (const block of content) visit(block);
  for (const block of footerBlocks) visit(block);

  if (options.attachmentNames && options.attachmentNames.length > 0) {
    ensureSpace(20 + options.attachmentNames.length * 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Attachments", MARGIN_X, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    for (const name of options.attachmentNames) {
      doc.text(`• ${name}`, MARGIN_X, y);
      y += 14;
    }
  }

  if (pageNumbering) {
    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Page ${page} of ${totalPages}`, PAGE_WIDTH_PT - MARGIN_X, PAGE_HEIGHT_PT - 40, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
