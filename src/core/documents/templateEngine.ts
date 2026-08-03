import type { AutomationConditionOperator } from "@/types/automation";
import type { DocumentBlock, MergeValue, TextRun } from "@/types/documentPlatform";

/**
 * Step 3's own Template Engine — a generic block-tree walker. It never
 * hardcodes a template: every document type's own `content`/`header`/`footer`
 * is the same `DocumentBlock[]` shape (Step 1), so this file has no
 * knowledge of "Contract" or "Invoice" at all. Variables, Conditional
 * Sections, Loops, Formatting, Rich Text, Headers, Footers, Page Breaks,
 * Images, and Tables are all real structural block types the walker
 * recurses over — never a special case bolted on for one document type.
 */

/** The variable scope a block tree renders against — every registered Merge Field's own resolved value, plus (inside a `loop` block's own `itemBlocks`) an `item` binding for the current list element. */
export type TemplateScope = Record<string, MergeValue>;

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/** Dotted-path lookup — `"item.description"` reads `scope.item.description` when `item` resolved to a record, `null` for any missing/non-record segment (never throws). */
function resolvePath(scope: TemplateScope, path: string): MergeValue {
  const segments = path.split(".");
  let current: MergeValue = scope[segments[0]] ?? null;
  for (let i = 1; i < segments.length; i++) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return null;
    current = current[segments[i]] ?? null;
  }
  return current;
}

function formatMergeValue(value: MergeValue): string {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map(formatMergeValue).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

/** Every `{{key}}`/`{{item.field}}` reference inside a string, deduplicated — the Compiler's own `missing_variable`/`unknown_field` validation reads this before rendering anything. */
export function extractPlaceholdersFromText(text: string): string[] {
  const matches = [...text.matchAll(PLACEHOLDER_PATTERN)];
  return [...new Set(matches.map((match) => match[1]))];
}

/**
 * Substitutes every `{{key}}`/`{{item.field}}` reference in a plain string
 * against `scope` — the same primitive `interpolateRuns()` below applies
 * per-`TextRun` for a full block tree. Exported (v2 Checkpoint 44, Step 8)
 * so the Email Template Library can resolve a `NotificationTemplate`'s own
 * plain-string `titleTemplate`/`bodyTemplate` through the identical
 * placeholder syntax and lookup rules — never a second interpolation
 * implementation for "string, not block-tree" templates.
 */
export function interpolateText(text: string, scope: TemplateScope): string {
  return text.replace(PLACEHOLDER_PATTERN, (_, path: string) => formatMergeValue(resolvePath(scope, path)));
}

function interpolateRuns(runs: TextRun[], scope: TemplateScope): TextRun[] {
  return runs.map((run) => ({ ...run, text: interpolateText(run.text, scope) }));
}

/** The same eight-operator comparison `core/automation/conditions.ts`'s own `compare()` already implements — kept as its own small copy here rather than a shared import, since the two live against differently-shaped "expected value" types (`AutomationCondition["value"]` vs `MergeValue`) that would otherwise force an awkward common supertype. */
function compare(operator: AutomationConditionOperator, actual: MergeValue, expected: MergeValue): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && (typeof actual === "string" || typeof actual === "number") && expected.includes(actual);
    case "notIn":
      return Array.isArray(expected) && (typeof actual === "string" || typeof actual === "number") && !expected.includes(actual);
    default:
      return false;
  }
}

/**
 * Every Merge Field key a block tree references, anywhere — `TextRun.text`,
 * `ImageBlock.src`/`alt`, a `ConditionalBlock`'s own `field`, a `LoopBlock`'s
 * own `source` — walked recursively through `conditional`/`loop` children.
 * Used only for pre-render validation (Step 5); never touches a resolved
 * value.
 */
export function extractTemplateFields(blocks: DocumentBlock[]): string[] {
  const keys = new Set<string>();

  function visitRuns(runs: TextRun[]) {
    for (const run of runs) {
      for (const key of extractPlaceholdersFromText(run.text)) keys.add(key);
    }
  }

  function visit(block: DocumentBlock) {
    switch (block.type) {
      case "heading":
      case "paragraph":
        visitRuns(block.runs);
        return;
      case "table":
        for (const row of block.rows) for (const cell of row) visitRuns(cell);
        return;
      case "image":
        for (const key of extractPlaceholdersFromText(block.src)) keys.add(key);
        for (const key of extractPlaceholdersFromText(block.alt)) keys.add(key);
        return;
      case "pageBreak":
      case "divider":
        return;
      case "conditional":
        keys.add(block.field);
        for (const child of block.blocks) visit(child);
        return;
      case "loop":
        keys.add(block.source);
        for (const child of block.itemBlocks) visit(child);
        return;
    }
  }

  for (const block of blocks) visit(block);
  return [...keys];
}

/**
 * Renders a block tree against a resolved `scope` — the Step 5 Compiler's
 * own "Template + Resolved Variables → Final Document" step, made concrete.
 * `conditional`/`loop` control-flow blocks never survive into the output:
 * a `conditional` either splices its own `blocks` in place (recursively
 * rendered) or contributes nothing; a `loop` splices one rendered copy of
 * `itemBlocks` per list element, each with its own `item` binding in scope.
 * A compiled Document's own `content` is therefore always flat, concrete
 * content — no residual control-flow block ever appears in Preview.
 */
export function renderBlocks(blocks: DocumentBlock[], scope: TemplateScope): DocumentBlock[] {
  const rendered: DocumentBlock[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
      case "paragraph":
        rendered.push({ ...block, runs: interpolateRuns(block.runs, scope) });
        break;
      case "table":
        rendered.push({ ...block, rows: block.rows.map((row) => row.map((cell) => interpolateRuns(cell, scope))) });
        break;
      case "image":
        rendered.push({ ...block, src: interpolateText(block.src, scope), alt: interpolateText(block.alt, scope) });
        break;
      case "pageBreak":
      case "divider":
        rendered.push(block);
        break;
      case "conditional": {
        const actual = resolvePath(scope, block.field);
        if (compare(block.operator, actual, block.value)) {
          rendered.push(...renderBlocks(block.blocks, scope));
        }
        break;
      }
      case "loop": {
        const list = resolvePath(scope, block.source);
        const items = Array.isArray(list) ? list : [];
        for (const item of items) {
          rendered.push(...renderBlocks(block.itemBlocks, { ...scope, item }));
        }
        break;
      }
    }
  }

  return rendered;
}
