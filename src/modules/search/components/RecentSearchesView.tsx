"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getSearchHistoryAction, clearSearchHistoryAction } from "@/modules/search/searchActions";
import type { SearchHistoryEntry } from "@/types/globalSearch";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * v2.0 Checkpoint 40 — the signed-in member's own last searches, reading
 * `getSearchHistoryAction()` (the same history `searchAction()` itself
 * records on every non-empty query) — never a second history store.
 */
export function RecentSearchesView({ onSelect }: { onSelect: (term: string) => void }) {
  const [entries, setEntries] = useState<SearchHistoryEntry[] | null>(null);

  useEffect(() => {
    getSearchHistoryAction().then((result) => {
      if (result.success) setEntries(result.data);
    });
  }, []);

  async function handleClear() {
    const result = await clearSearchHistoryAction();
    if (result.success) setEntries(result.data);
  }

  if (!entries) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-text">Recent Searches</h3>
        {entries.length > 0 ? (
          <Button type="button" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No searches yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {entries.slice(0, 8).map((entry) => (
            <li key={entry.id}>
              <button type="button" onClick={() => onSelect(entry.term)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:text-accent">
                <span className="truncate text-text">{entry.term}</span>
                <span className="shrink-0 text-xs text-text-muted">
                  {entry.resultCount} result{entry.resultCount === 1 ? "" : "s"} · {formatDateTime(entry.searched_at)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
