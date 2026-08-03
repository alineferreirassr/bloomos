"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getDocumentSuggestionsAction } from "@/modules/documentTemplates/getDocumentSuggestionsAction";
import type { DocumentBlock, DocumentSuggestion, ParagraphBlock } from "@/types/documentPlatform";

interface SuggestionsPanelProps {
  templateId: string;
  content: DocumentBlock[];
  onApplyWording: (blockId: string, suggestedRuns: DocumentSuggestion["suggestedRuns"]) => void;
  onAddMissingSection: (block: ParagraphBlock) => void;
}

const KIND_LABELS: Record<DocumentSuggestion["kind"], string> = {
  missing_section: "Missing Section",
  wording: "Wording",
  tone: "Tone",
};

/**
 * Step 10's own Bloom AI Integration surface — every suggestion here is
 * inert (`core/documents/suggestions.ts`'s own doc comment: "nothing here
 * ever edits a Template/Document") until this panel's own "Apply"/"Add"
 * control runs, which only ever updates the Editor's local draft state —
 * the same autosave path a manual edit already goes through. Bloom AI
 * never publishes automatically.
 */
export function SuggestionsPanel({ templateId, content, onApplyWording, onAddMissingSection }: SuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const result = await getDocumentSuggestionsAction(templateId);
    setLoading(false);
    if (result.success) {
      setSuggestions(result.suggestions);
      setDismissed(new Set());
    }
  }

  function applySuggestion(index: number, suggestion: DocumentSuggestion) {
    if (suggestion.kind === "missing_section" && suggestion.suggestedRuns) {
      onAddMissingSection({ id: `block_${crypto.randomUUID()}`, type: "paragraph", runs: suggestion.suggestedRuns });
    } else if (suggestion.blockId && suggestion.suggestedRuns) {
      onApplyWording(suggestion.blockId, suggestion.suggestedRuns);
    }
    setDismissed((prev) => new Set(prev).add(index));
  }

  const visible = (suggestions ?? []).map((s, i) => ({ suggestion: s, index: i })).filter(({ index }) => !dismissed.has(index));

  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
        {loading ? "Analyzing…" : "Get Suggestions"}
      </Button>
      {suggestions !== null && visible.length === 0 ? <p className="text-sm text-text/55">No suggestions right now.</p> : null}
      <ul className="flex flex-col gap-2">
        {visible.map(({ suggestion, index }) => (
          <li key={index} className="rounded-md border border-border p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <Badge tone="outline">{KIND_LABELS[suggestion.kind]}</Badge>
            </div>
            <p className="text-xs text-text/70">{suggestion.reason}</p>
            {suggestion.suggestedRuns ? <p className="mt-1 text-xs italic text-accent">{suggestion.suggestedRuns.map((run) => run.text).join(" ")}</p> : null}
            <div className="mt-1.5 flex gap-1.5">
              <Button type="button" variant="ghost" onClick={() => setDismissed((prev) => new Set(prev).add(index))}>
                Dismiss
              </Button>
              <Button type="button" onClick={() => applySuggestion(index, suggestion)}>
                {suggestion.kind === "missing_section" ? "Add to Content" : "Apply"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {content.length === 0 && suggestions === null ? <p className="text-xs text-text/45">Analyzes the Template&rsquo;s own current content for missing sections and informal wording.</p> : null}
    </div>
  );
}
