import type { AssetVersion } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2/4 — superseded-version history for `MediaAsset`. Empty until a real replace happens; no seed data, mirroring `mediaFoldersStore.ts`'s own reasoning. */
let assetVersions: AssetVersion[] = [];

export function readAssetVersions(): AssetVersion[] {
  return assetVersions;
}

export function writeAssetVersions(next: AssetVersion[]): void {
  assetVersions = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetVersionsStore(): void {
  assetVersions = [];
}
