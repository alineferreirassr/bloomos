"use client";

import { useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PROMPT_LIBRARY, PROMPT_CATEGORIES, PROMPT_CATEGORY_LABELS, type PromptTemplate } from "@/modules/ai/copilot/promptLibrary/prompts";
import { listFavoritePromptIds, toggleFavoritePrompt } from "@/modules/ai/copilot/copilotPreferences";
import { WritingStudioModal } from "@/modules/ai/copilot/writing/WritingStudioModal";

/** Checkpoint 20, Step 15 — the Prompt Library page, reachable from the Copilot Panel's footer link. */
export function PromptLibraryView() {
  const session = useMemberSession();
  const [favoriteIds, setFavoriteIds] = useState<Set<string> | null>(null);
  const [activePrompt, setActivePrompt] = useState<PromptTemplate | null>(null);

  useEffect(() => {
    if (session.status !== "active" || !session.workspace || !session.user) return;
    listFavoritePromptIds(session.workspace.id, session.user.id).then((ids) => setFavoriteIds(new Set(ids)));
  }, [session]);

  async function handleToggleFavorite(prompt: PromptTemplate) {
    if (!favoriteIds || session.status !== "active" || !session.workspace || !session.user) return;
    const isFavorite = favoriteIds.has(prompt.id);
    await toggleFavoritePrompt(session.workspace.id, session.user.id, prompt.id, prompt.title, !isFavorite);
    const next = new Set(favoriteIds);
    if (isFavorite) next.delete(prompt.id);
    else next.add(prompt.id);
    setFavoriteIds(next);
  }

  return (
    <div>
      <PageHeader title="Prompt Library" subtitle="Categorized starting points for Bloom AI's Writing Studio. Save your favorites for quick reuse." />

      {PROMPT_CATEGORIES.map((category) => (
        <div key={category} className="mb-6">
          <h3 className="mb-2 font-serif text-lg font-semibold text-text">{PROMPT_CATEGORY_LABELS[category]}</h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PROMPT_LIBRARY.filter((prompt) => prompt.category === category).map((prompt) => (
              <div key={prompt.id} className="rounded-lg border border-border bg-surface p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-text">{prompt.title}</p>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(prompt)}
                    aria-label={favoriteIds?.has(prompt.id) ? "Remove from favorites" : "Save as favorite"}
                    className="shrink-0 text-lg text-accent"
                  >
                    {favoriteIds ? (favoriteIds.has(prompt.id) ? "★" : "☆") : <Skeleton className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">{prompt.template}</p>
                <Button type="button" variant="secondary" onClick={() => setActivePrompt(prompt)} className="mt-2">
                  Open in Writing Studio
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {activePrompt ? (
        <WritingStudioModal open onClose={() => setActivePrompt(null)} initialText={activePrompt.template} />
      ) : null}
    </div>
  );
}
