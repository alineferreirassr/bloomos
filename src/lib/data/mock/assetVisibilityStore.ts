import type { AssetVisibility } from "@/types/digitalAssets";

/**
 * v2.0 Checkpoint 37, Step 2/9 — an explicit visibility *override* per
 * asset. `MediaAsset` has no `visibility` column of its own; the Permission
 * Engine derives a sensible default from `owner_type` (see
 * `core/digitalAssets/permissionEngine.ts`), and this store holds only the
 * assets where someone has explicitly chosen something different — the same
 * "override, falls back to a derived default" shape
 * `client_portal_preferences.communication_preference` already established
 * for the Client Portal (Checkpoint 36).
 */
let assetVisibilityOverrides: Record<string, AssetVisibility> = {};

export function readAssetVisibilityOverrides(): Record<string, AssetVisibility> {
  return assetVisibilityOverrides;
}

export function writeAssetVisibilityOverrides(next: Record<string, AssetVisibility>): void {
  assetVisibilityOverrides = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetVisibilityStore(): void {
  assetVisibilityOverrides = {};
}
