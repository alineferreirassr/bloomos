import type { AssetDownload } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2/8 — one row per real download, the usage-tracking counter `MediaAsset` never had before this checkpoint. Fed by the same repository `downloadMediaAsset`/`getMediaAssetDownloadUrl` call sites already exist for — this only adds the record-keeping, never a new download mechanism. */
let assetDownloads: AssetDownload[] = [];

export function readAssetDownloads(): AssetDownload[] {
  return assetDownloads;
}

export function writeAssetDownloads(next: AssetDownload[]): void {
  assetDownloads = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetDownloadsStore(): void {
  assetDownloads = [];
}
