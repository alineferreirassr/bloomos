import type { WorkspaceFavorite } from "@/types/smartWorkspace";
import type { EntityType } from "@/core/enums/entityType";

/** v2.0 Checkpoint 38, Step 7 — pure list transforms over already-fetched favorites; persistence is the module actions layer's job. */

export function isFavorited(favorites: WorkspaceFavorite[], entityType: EntityType, entityId: string): boolean {
  return favorites.some((f) => f.entity_type === entityType && f.entity_id === entityId);
}

export function findFavorite(favorites: WorkspaceFavorite[], entityType: EntityType, entityId: string): WorkspaceFavorite | null {
  return favorites.find((f) => f.entity_type === entityType && f.entity_id === entityId) ?? null;
}

export function removeFavoriteById(favorites: WorkspaceFavorite[], favoriteId: string): WorkspaceFavorite[] {
  return favorites.filter((f) => f.id !== favoriteId);
}

export function sortFavoritesByRecency(favorites: WorkspaceFavorite[]): WorkspaceFavorite[] {
  return [...favorites].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function groupFavoritesByEntityType(favorites: WorkspaceFavorite[]): Record<string, WorkspaceFavorite[]> {
  const groups: Record<string, WorkspaceFavorite[]> = {};
  for (const favorite of favorites) {
    const key = favorite.entity_type;
    groups[key] = groups[key] ? [...groups[key], favorite] : [favorite];
  }
  return groups;
}

/** v2.0 Checkpoint 40 — flips `pinned` on the matching favorite; a no-op array copy if `favoriteId` isn't found, matching `removeFavoriteById`'s own "missing id is not an error" behavior. */
export function togglePinned(favorites: WorkspaceFavorite[], favoriteId: string): WorkspaceFavorite[] {
  return favorites.map((f) => (f.id === favoriteId ? { ...f, pinned: !f.pinned } : f));
}

/** Pinned first (newest-pinned first within that group), then the rest by recency — the same "pinned promotes, never re-derives a second ranking" rule `WorkspaceWidgetPreference`'s own `pinned`/`order` fields already use. */
export function sortFavoritesByPinnedThenRecency(favorites: WorkspaceFavorite[]): WorkspaceFavorite[] {
  const byRecency = sortFavoritesByRecency(favorites);
  const pinned = byRecency.filter((f) => f.pinned);
  const unpinned = byRecency.filter((f) => !f.pinned);
  return [...pinned, ...unpinned];
}
