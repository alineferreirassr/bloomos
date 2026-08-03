import type { WorkspaceFavorite } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 2 — one row per (workspace, member, entity)
 * favorite. Generalizes `assetFavoritesStore.ts` (Checkpoint 37) from
 * "asset only" to any `EntityType` — the first cross-entity favorites
 * concept in BloomOS.
 */
let workspaceFavorites: WorkspaceFavorite[] = [];

export function readWorkspaceFavorites(): WorkspaceFavorite[] {
  return workspaceFavorites;
}

export function writeWorkspaceFavorites(next: WorkspaceFavorite[]): void {
  workspaceFavorites = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetWorkspaceFavoritesStore(): void {
  workspaceFavorites = [];
}
