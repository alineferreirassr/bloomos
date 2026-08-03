import type { MediaCollection } from "@/types/mediaCollection";

/** No seed data — same reasoning as `mediaAssetsStore.ts`/`mediaFoldersStore.ts`. */
let mediaCollections: MediaCollection[] = [];

export function readMediaCollections(): MediaCollection[] {
  return mediaCollections;
}

export function writeMediaCollections(next: MediaCollection[]): void {
  mediaCollections = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetMediaCollectionsStore(): void {
  mediaCollections = [];
}
