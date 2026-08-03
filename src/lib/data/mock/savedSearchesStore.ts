import type { SavedSearch } from "@/types/globalSearch";

/** v2.0 Checkpoint 40 — same `let` array + `resetXStore()` convention every mock store in this codebase uses. Mock-only, no Supabase table exists yet. */
let savedSearches: SavedSearch[] = [];

export function resetSavedSearchesStore(): void {
  savedSearches = [];
}

export function readSavedSearches(): SavedSearch[] {
  return savedSearches;
}

export function writeSavedSearches(next: SavedSearch[]): void {
  savedSearches = next;
}
