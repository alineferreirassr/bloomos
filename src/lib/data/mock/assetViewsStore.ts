import type { AssetView } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2/11 — the "Views" counter Step 11's Analytics Engine names, recorded once per Asset Detail page load (`recordAssetViewAction`), the same "explicit call site, never inferred" discipline every other Timeline/Activity log in this codebase holds to. */
let assetViews: AssetView[] = [];

export function readAssetViews(): AssetView[] {
  return assetViews;
}

export function writeAssetViews(next: AssetView[]): void {
  assetViews = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetViewsStore(): void {
  assetViews = [];
}
