"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { listSavedSearchesAction, deleteSavedSearchAction } from "@/modules/search/searchActions";
import type { SavedSearch } from "@/types/globalSearch";

/**
 * v2.0 Checkpoint 40 — the signed-in member's own saved searches. Creating
 * one happens from `SearchResultsView` (where the term/filters actually
 * live); this view only lists and deletes, reusing `listSavedSearchesAction()`
 * / `deleteSavedSearchAction()` directly rather than re-deriving state.
 */
export function SavedSearchesView({ onSelect }: { onSelect: (search: SavedSearch) => void }) {
  const [searches, setSearches] = useState<SavedSearch[] | null>(null);

  useEffect(() => {
    listSavedSearchesAction().then((result) => {
      if (result.success) setSearches(result.data);
    });
  }, []);

  async function handleDelete(id: string) {
    const result = await deleteSavedSearchAction(id);
    if (result.success) setSearches(result.data);
  }

  if (!searches) return null;

  return (
    <Card>
      <h3 className="font-serif text-base font-semibold text-text">Saved Searches</h3>
      {searches.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No saved searches yet — save one from your search results.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {searches.map((search) => (
            <li key={search.id} className="flex items-center justify-between gap-2 py-1.5">
              <button type="button" onClick={() => onSelect(search)} className="truncate text-left text-text hover:text-accent">
                {search.label}
              </button>
              <Button type="button" variant="ghost" onClick={() => handleDelete(search.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
