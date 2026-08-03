import type { AssetFavorite } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2 — one row per (asset, member) favorite, mirroring `MediaCollection.is_favorite`'s own boolean-flag simplicity but for individual assets, which have no such flag on `MediaAsset` itself. */
let assetFavorites: AssetFavorite[] = [];

export function readAssetFavorites(): AssetFavorite[] {
  return assetFavorites;
}

export function writeAssetFavorites(next: AssetFavorite[]): void {
  assetFavorites = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetFavoritesStore(): void {
  assetFavorites = [];
}
