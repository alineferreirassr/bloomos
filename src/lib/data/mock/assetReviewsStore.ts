import type { AssetReview } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 2 — the approval-decision history `MediaAsset.status`/`approved_by`/`approved_at`/`rejection_reason` doesn't keep (those fields hold only the current state). */
let assetReviews: AssetReview[] = [];

export function readAssetReviews(): AssetReview[] {
  return assetReviews;
}

export function writeAssetReviews(next: AssetReview[]): void {
  assetReviews = next;
}

/** Test-only: restore the store to its empty state between test cases. */
export function resetAssetReviewsStore(): void {
  assetReviews = [];
}
