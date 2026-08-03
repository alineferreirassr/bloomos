import type { MediaAsset } from "@/types/mediaAsset";

/**
 * No seed data — unlike Leads/Clients/Events, the Media Library has no
 * consuming module or UI yet, so there's no realistic owner to fabricate
 * linkage to. Tests create their own fixtures directly.
 *
 * The blob map holds real file bytes alongside the metadata array (both
 * reset together) so mock mode's downloadMediaAsset/verifyMediaAssetChecksum
 * are genuinely functional, not metadata-only like the older Documents
 * mock — see docs/database.md's Media Library section.
 */
let mediaAssets: MediaAsset[] = [];
let blobs = new Map<string, Blob>();

export function readMediaAssets(): MediaAsset[] {
  return mediaAssets;
}

export function writeMediaAssets(next: MediaAsset[]): void {
  mediaAssets = next;
}

export function readMediaAssetBlob(storagePath: string): Blob | undefined {
  return blobs.get(storagePath);
}

export function writeMediaAssetBlob(storagePath: string, blob: Blob): void {
  blobs.set(storagePath, blob);
}

export function deleteMediaAssetBlob(storagePath: string): void {
  blobs.delete(storagePath);
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetMediaAssetsStore(): void {
  mediaAssets = [];
  blobs = new Map();
}
