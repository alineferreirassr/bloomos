import { extractTemplateFields } from "@/core/documents/templateEngine";
import type { DocumentBlock, DocumentSuggestion, DocumentTypeDefinition, Template, TextRun } from "@/types/documentPlatform";

/**
 * Step 10's own Bloom AI Integration — "suggest wording, rewrite
 * paragraphs, improve tone, fill missing sections... never publish
 * automatically." Deterministic, not generative — the same scope decision
 * Checkpoint 10's own Workflow suggestions made ("a rule over real state,
 * never a generative call") rather than standing up a full new Skill
 * (Prompt Registry entry, output schema, mock provider) for what's
 * fundamentally pattern analysis over a Template's own block tree. A
 * `DocumentSuggestion` is always inert: nothing here ever edits a
 * Template/Document — only a human, from the Editor's own "Apply"
 * control, does.
 */

const INFORMAL_REPLACEMENTS: Record<string, string> = {
  "don't": "do not",
  "can't": "cannot",
  "won't": "will not",
  "isn't": "is not",
  "gonna": "going to",
  "wanna": "want to",
  hey: "hello",
  yeah: "yes",
  thanks: "thank you",
};

function findInformalWords(text: string): string[] {
  const found: string[] = [];
  for (const word of Object.keys(INFORMAL_REPLACEMENTS)) {
    const pattern = new RegExp(`\\b${word.replace("'", "'")}\\b`, "i");
    if (pattern.test(text)) found.push(word);
  }
  return found;
}

function applyToneReplacements(text: string): string {
  let result = text;
  for (const [informal, formal] of Object.entries(INFORMAL_REPLACEMENTS)) {
    result = result.replace(new RegExp(`\\b${informal}\\b`, "gi"), formal);
  }
  return result;
}

function blockOwnRuns(block: DocumentBlock): { runs: TextRun[] } | null {
  if (block.type === "heading" || block.type === "paragraph") return { runs: block.runs };
  return null;
}

/**
 * "Improve tone" — flags any heading/paragraph block whose own text
 * contains a known-informal word/contraction, suggesting the same block
 * with every occurrence formalized. Recurses into `conditional`/`loop`
 * children, matching the Template Engine's own tree-walk.
 */
export function getWordingSuggestions(template: Template): DocumentSuggestion[] {
  const suggestions: DocumentSuggestion[] = [];

  function visit(block: DocumentBlock) {
    const own = blockOwnRuns(block);
    if (own) {
      const combinedText = own.runs.map((run) => run.text).join(" ");
      const informalWords = findInformalWords(combinedText);
      if (informalWords.length > 0) {
        suggestions.push({
          templateId: template.id,
          blockId: block.id,
          kind: "tone",
          reason: `Contains informal language (${informalWords.join(", ")}) — consider a more formal tone for a client-facing document.`,
          suggestedRuns: own.runs.map((run) => ({ ...run, text: applyToneReplacements(run.text) })),
        });
      }
    }
    if (block.type === "conditional") for (const child of block.blocks) visit(child);
    if (block.type === "loop") for (const child of block.itemBlocks) visit(child);
  }

  for (const block of [...template.header, ...template.content, ...template.footer]) visit(block);
  return suggestions;
}

const MAX_MISSING_SECTION_SUGGESTIONS = 3;

/**
 * "Fill missing sections" — a document type's own `suggestedMergeFieldKeys`
 * (Step 2) that the Template's own block tree never references at all.
 * Each suggestion proposes one new paragraph referencing that field; the
 * Editor's own "Add to Content" control is the only thing that ever
 * actually adds it.
 */
export function getMissingSectionSuggestions(template: Template, documentType: DocumentTypeDefinition | null): DocumentSuggestion[] {
  if (!documentType) return [];
  const referenced = new Set(extractTemplateFields([...template.header, ...template.content, ...template.footer]));
  const missing = documentType.suggestedMergeFieldKeys.filter((key) => !referenced.has(key));

  return missing.slice(0, MAX_MISSING_SECTION_SUGGESTIONS).map((key) => ({
    templateId: template.id,
    blockId: null,
    kind: "missing_section",
    reason: `"${documentType.label}" Templates typically reference {{${key}}}, but this one doesn't yet.`,
    suggestedRuns: [{ text: `{{${key}}}` }],
  }));
}

export function getDocumentSuggestions(template: Template, documentType: DocumentTypeDefinition | null): DocumentSuggestion[] {
  return [...getMissingSectionSuggestions(template, documentType), ...getWordingSuggestions(template)];
}
