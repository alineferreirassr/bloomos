import { extractTemplateFields } from "@/core/documents/templateEngine";
import { listMergeFields } from "@/core/documents/mergeFieldRegistry";
import type { ComposedDocument, DocumentBlock, Template, TextRun } from "@/types/documentPlatform";

/**
 * Step 15's own Global Document Search — ranked, not filtered, mirroring
 * `core/settings/search.ts`'s own precedent exactly. Searches both
 * `Template`s and `ComposedDocument`s in one pass since both are real,
 * navigable entities a member might be looking for by the same query.
 * Callers (`searchDocumentsAction.ts`) are responsible for scoping the
 * `templates`/`documents` arrays to what the searching member may already
 * see — this function itself has no permission awareness of its own,
 * exactly like `searchSettings()` relies on its own caller having already
 * filtered.
 */
export interface DocumentSearchResult {
  kind: "template" | "document";
  id: string;
  title: string;
  description: string;
  score: number;
}

function collectBlockText(blocks: DocumentBlock[]): string {
  const parts: string[] = [];

  function runsText(runs: TextRun[]) {
    for (const run of runs) parts.push(run.text);
  }

  function visit(block: DocumentBlock) {
    if (block.type === "heading" || block.type === "paragraph") runsText(block.runs);
    else if (block.type === "table") for (const row of block.rows) for (const cell of row) runsText(cell);
    else if (block.type === "image") parts.push(block.alt);
    else if (block.type === "conditional") for (const child of block.blocks) visit(child);
    else if (block.type === "loop") for (const child of block.itemBlocks) visit(child);
  }

  for (const block of blocks) visit(block);
  return parts.join(" ");
}

function scoreText(query: string, ...fields: string[]): number {
  let best = 0;
  for (const field of fields) {
    const normalized = field.toLowerCase();
    if (normalized === query) best = Math.max(best, 100);
    else if (normalized.startsWith(query)) best = Math.max(best, 80);
    else if (normalized.includes(query)) best = Math.max(best, 50);
  }
  return best;
}

function scoreTemplate(query: string, template: Template): number {
  let score = scoreText(query, template.name, template.description);

  const referencedKeys = extractTemplateFields([...template.header, ...template.content, ...template.footer]);
  for (const key of referencedKeys) {
    const definition = listMergeFields().find((field) => field.key === key);
    score = Math.max(score, scoreText(query, key, definition?.label ?? ""));
  }

  const contentText = collectBlockText([...template.header, ...template.content, ...template.footer]);
  if (contentText.toLowerCase().includes(query)) score = Math.max(score, 30);

  return score;
}

function scoreDocument(query: string, document: ComposedDocument): number {
  let score = scoreText(query, document.metadata.title, document.metadata.description, document.metadata.clientName ?? "", document.metadata.eventTitle ?? "", ...document.metadata.tags);
  const contentText = collectBlockText(document.content);
  if (contentText.toLowerCase().includes(query)) score = Math.max(score, 30);
  return score;
}

/** An empty/whitespace-only query returns nothing — Search narrows, it doesn't browse (the Template Library/Recent Documents lists already cover that). Results cap at 20. */
export function searchDocuments(query: string, templates: Template[], documents: ComposedDocument[]): DocumentSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const results: DocumentSearchResult[] = [];

  for (const template of templates) {
    const score = scoreTemplate(normalizedQuery, template);
    if (score > 0) results.push({ kind: "template", id: template.id, title: template.name, description: template.description, score });
  }

  for (const document of documents) {
    const score = scoreDocument(normalizedQuery, document);
    if (score > 0) results.push({ kind: "document", id: document.id, title: document.metadata.title, description: document.metadata.clientName ?? document.metadata.eventTitle ?? "", score });
  }

  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 20);
}
