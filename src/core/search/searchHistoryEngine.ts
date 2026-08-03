import type { SearchHistoryEntry } from "@/types/globalSearch";

/** v2.0 Checkpoint 40 — pure list management for raw search history: de-dupe consecutive identical terms, cap length, most-recent-first. Mirrors `recentItemsEngine.ts`'s own shape exactly. */

export const MAX_SEARCH_HISTORY = 50;

export function recordSearchHistoryEntry(existing: SearchHistoryEntry[], entry: SearchHistoryEntry): SearchHistoryEntry[] {
  const withoutDuplicateTerm = existing.filter((item) => item.term.trim().toLowerCase() !== entry.term.trim().toLowerCase());
  const next = [entry, ...withoutDuplicateTerm];
  return next.slice(0, MAX_SEARCH_HISTORY);
}

export function sortSearchHistoryByRecency(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
  return [...entries].sort((a, b) => new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime());
}

/** Every history entry whose `resultCount` was `0` — feeds Search Analytics' own "no-result searches" metric directly, never a second count. */
export function noResultSearchHistory(entries: SearchHistoryEntry[]): SearchHistoryEntry[] {
  return entries.filter((entry) => entry.resultCount === 0);
}
