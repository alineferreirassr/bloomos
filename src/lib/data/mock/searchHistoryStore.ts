import type { SearchHistoryEntry } from "@/types/globalSearch";

/** v2.0 Checkpoint 40 — same `let` array + `resetXStore()` convention every mock store in this codebase uses. Mock-only, no Supabase table exists yet. */
let searchHistory: SearchHistoryEntry[] = [];

export function resetSearchHistoryStore(): void {
  searchHistory = [];
}

export function readSearchHistory(): SearchHistoryEntry[] {
  return searchHistory;
}

export function writeSearchHistory(next: SearchHistoryEntry[]): void {
  searchHistory = next;
}
