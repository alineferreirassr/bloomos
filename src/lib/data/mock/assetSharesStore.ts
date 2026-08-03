import type { AssetShare } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2 — "Share Placeholder" (spec): records who an asset was shared with inside BloomOS. No real link, email, or external access token is ever generated — see `types/digitalAssets.ts`'s own `AssetShare` doc comment. */
let assetShares: AssetShare[] = [];

export function readAssetShares(): AssetShare[] {
  return assetShares;
}

export function writeAssetShares(next: AssetShare[]): void {
  assetShares = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetSharesStore(): void {
  assetShares = [];
}
