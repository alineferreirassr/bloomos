import type { SavedSearch } from "@/types/globalSearch";

/** v2.0 Checkpoint 40 — pure list transforms over already-fetched saved searches; persistence is the module actions layer's job, the same split `favoritesEngine.ts` already established. */

export function sortSavedSearchesByRecency(searches: SavedSearch[]): SavedSearch[] {
  return [...searches].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function removeSavedSearchById(searches: SavedSearch[], savedSearchId: string): SavedSearch[] {
  return searches.filter((s) => s.id !== savedSearchId);
}

export function findSavedSearchByLabel(searches: SavedSearch[], label: string): SavedSearch | null {
  const normalized = label.trim().toLowerCase();
  return searches.find((s) => s.label.trim().toLowerCase() === normalized) ?? null;
}
