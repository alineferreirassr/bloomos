import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaFolder } from "@/types/mediaFolder";
import type { AssetDownload, AssetView, AssetFavorite, AssetShare, AssetAnalytics, AssetStorageBreakdownEntry, AssetAnalyticsTopEntry } from "@/types/digitalAssets";

/** v2.0 Checkpoint 37, Step 11 — Analytics Engine. Pure aggregation over already-fetched data; no new tracking mechanism beyond the Step 2 stores this checkpoint itself added (downloads/views/favorites/shares) plus the real, existing Comments Platform for comment counts. */
export interface AssetAnalyticsInput {
  workspaceId: string;
  assets: MediaAsset[];
  folders: MediaFolder[];
  downloads: AssetDownload[];
  views: AssetView[];
  favorites: AssetFavorite[];
  shares: AssetShare[];
  commentCountByAssetId: Record<string, number>;
  clientNameByOwnerId: Record<string, string>;
  unusedAssetIds: ReadonlySet<string>;
  now?: Date;
}

const TOP_ENTRY_LIMIT = 10;

export function buildAssetAnalytics(input: AssetAnalyticsInput): AssetAnalytics {
  const activeAssets = input.assets.filter((asset) => !asset.archived_at);
  const now = input.now ?? new Date();

  const folderNameById = new Map(input.folders.map((folder) => [folder.id, folder.name]));
  const storageByFolder = groupStorage(activeAssets, (asset) => (asset.folder_id ? { key: asset.folder_id, label: folderNameById.get(asset.folder_id) ?? "Unknown Folder" } : { key: "unfiled", label: "Unfiled" }));

  const clientAssets = activeAssets.filter((asset) => asset.owner_type === "client");
  const storageByClient = groupStorage(clientAssets, (asset) => ({ key: asset.owner_id, label: input.clientNameByOwnerId[asset.owner_id] ?? "Unknown Client" }));

  const largestFiles: AssetAnalyticsTopEntry[] = [...activeAssets]
    .sort((a, b) => b.file_size - a.file_size)
    .slice(0, TOP_ENTRY_LIMIT)
    .map((asset) => ({ assetId: asset.id, filename: asset.original_filename, value: asset.file_size }));

  const viewCountByAsset = new Map<string, number>();
  for (const view of input.views) {
    viewCountByAsset.set(view.asset_id, (viewCountByAsset.get(view.asset_id) ?? 0) + 1);
  }
  const assetById = new Map(activeAssets.map((asset) => [asset.id, asset]));
  const mostViewed: AssetAnalyticsTopEntry[] = [...viewCountByAsset.entries()]
    .filter(([assetId]) => assetById.has(assetId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_ENTRY_LIMIT)
    .map(([assetId, value]) => ({ assetId, filename: assetById.get(assetId)!.original_filename, value }));

  return {
    workspaceId: input.workspaceId,
    totalAssets: activeAssets.length,
    totalStorageBytes: activeAssets.reduce((sum, asset) => sum + asset.file_size, 0),
    totalDownloads: input.downloads.length,
    totalViews: input.views.length,
    totalFavorites: input.favorites.length,
    totalShares: input.shares.filter((share) => !share.revoked_at).length,
    totalComments: Object.values(input.commentCountByAssetId).reduce((sum, count) => sum + count, 0),
    storageByFolder,
    storageByClient,
    largestFiles,
    mostViewed,
    unusedAssetCount: input.unusedAssetIds.size,
    generatedAt: now.toISOString(),
  };
}

function groupStorage(assets: MediaAsset[], keyFor: (asset: MediaAsset) => { key: string; label: string }): AssetStorageBreakdownEntry[] {
  const groups = new Map<string, AssetStorageBreakdownEntry>();
  for (const asset of assets) {
    const { key, label } = keyFor(asset);
    const existing = groups.get(key);
    if (existing) {
      existing.bytes += asset.file_size;
      existing.assetCount += 1;
    } else {
      groups.set(key, { key, label, bytes: asset.file_size, assetCount: 1 });
    }
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes);
}
