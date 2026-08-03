# Asset Analytics

`core/digitalAssets/analyticsEngine.ts` — pure aggregation over already-fetched data; no new tracking mechanism beyond the Step 2 stores this checkpoint itself added (downloads/views/favorites/shares) plus the real, existing Comments Platform for comment counts.

## What it computes

| Field | Source |
|---|---|
| `totalAssets` / `totalStorageBytes` | Active (non-archived) `MediaAsset` rows |
| `totalDownloads` / `totalViews` / `totalFavorites` / `totalShares` (non-revoked only) / `totalComments` | The new Step 2 stores + the real Comments Platform |
| `storageByFolder` | Grouped by `folder_id`, unfiled assets labeled "Unfiled" |
| `storageByClient` | Grouped by `owner_id` for `owner_type: "client"` assets only |
| `largestFiles` | Top 10 by `file_size` descending |
| `mostViewed` | Top 10 by view-record count descending |
| `unusedAssetCount` | Size of the caller-supplied unused-asset id set (from the Health Engine's own evaluation) |

## Named function

`buildAssetAnalytics(input: AssetAnalyticsInput): AssetAnalytics` — a single pure function; the module actions layer (`evaluatePlatformAction`) is responsible for gathering every input array from the real repositories/stores first.
