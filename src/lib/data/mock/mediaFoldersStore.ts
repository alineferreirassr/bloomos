import type { MediaFolder } from "@/types/mediaFolder";

/**
 * No seed data — mirrors `mediaAssetsStore.ts`'s own reasoning: the Asset
 * Library has no consuming UI yet to fabricate a realistic folder tree for.
 * Tests create their own fixtures directly.
 */
let mediaFolders: MediaFolder[] = [];

export function readMediaFolders(): MediaFolder[] {
  return mediaFolders;
}

export function writeMediaFolders(next: MediaFolder[]): void {
  mediaFolders = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetMediaFoldersStore(): void {
  mediaFolders = [];
}
