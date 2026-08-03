import type { DocumentBlock, TextRun } from "@/types/documentPlatform";

/**
 * A compiled Document's own plain-text export — the Document viewer's
 * "Download" control (Step 17's own "Track:... download"). Deliberately
 * plain text, not a PDF: this checkpoint's own objective is explicit that
 * the platform "is NOT a PDF generator." A future checkpoint could add a
 * richer export format without changing this function's own contract.
 */
function runsText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

export function blocksToPlainText(blocks: DocumentBlock[]): string {
  const lines: string[] = [];

  function visit(block: DocumentBlock) {
    switch (block.type) {
      case "heading":
        lines.push(runsText(block.runs).toUpperCase());
        break;
      case "paragraph":
        lines.push(runsText(block.runs));
        break;
      case "table":
        for (const row of block.rows) lines.push(row.map((cell) => runsText(cell)).join("\t"));
        break;
      case "image":
        lines.push(`[Image: ${block.alt || block.src}]`);
        break;
      case "pageBreak":
        lines.push("--- page break ---");
        break;
      case "divider":
        lines.push("***");
        break;
      case "conditional":
        for (const child of block.blocks) visit(child);
        break;
      case "loop":
        for (const child of block.itemBlocks) visit(child);
        break;
    }
  }

  for (const block of blocks) visit(block);
  return lines.join("\n\n");
}
