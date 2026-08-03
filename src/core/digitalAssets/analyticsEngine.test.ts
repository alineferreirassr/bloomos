import { describe, expect, it } from "vitest";
import { buildAssetAnalytics } from "@/core/digitalAssets/analyticsEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";
import type { MediaFolder } from "@/types/mediaFolder";

const NOW = new Date("2026-06-01T00:00:00.000Z");

function folder(overrides: Partial<MediaFolder> = {}): MediaFolder {
  return { id: "folder_1", workspace_id: "ws_1", owner_type: null, owner_id: null, parent_folder_id: null, name: "Brand", sort_order: 0, created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null, ...overrides };
}

describe("buildAssetAnalytics", () => {
  it("totals storage and asset counts, excluding archived assets", () => {
    const assets = [buildTestAsset({ id: "a1", file_size: 1000 }), buildTestAsset({ id: "a2", file_size: 2000, archived_at: "2026-01-02T00:00:00.000Z" })];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets, folders: [], downloads: [], views: [], favorites: [], shares: [], commentCountByAssetId: {}, clientNameByOwnerId: {}, unusedAssetIds: new Set(), now: NOW });
    expect(analytics.totalAssets).toBe(1);
    expect(analytics.totalStorageBytes).toBe(1000);
  });

  it("groups storage by folder, labeling unfiled assets separately", () => {
    const assets = [buildTestAsset({ id: "a1", folder_id: "folder_1", file_size: 500 }), buildTestAsset({ id: "a2", folder_id: null, file_size: 300 })];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets, folders: [folder()], downloads: [], views: [], favorites: [], shares: [], commentCountByAssetId: {}, clientNameByOwnerId: {}, unusedAssetIds: new Set(), now: NOW });
    const filed = analytics.storageByFolder.find((e) => e.label === "Brand");
    const unfiled = analytics.storageByFolder.find((e) => e.label === "Unfiled");
    expect(filed?.bytes).toBe(500);
    expect(unfiled?.bytes).toBe(300);
  });

  it("groups storage by client for client-owned assets only", () => {
    const assets = [buildTestAsset({ id: "a1", owner_type: "client", owner_id: "client_1", file_size: 100 }), buildTestAsset({ id: "a2", owner_type: "workspace", file_size: 900 })];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets, folders: [], downloads: [], views: [], favorites: [], shares: [], commentCountByAssetId: {}, clientNameByOwnerId: { client_1: "Jane Doe" }, unusedAssetIds: new Set(), now: NOW });
    expect(analytics.storageByClient).toHaveLength(1);
    expect(analytics.storageByClient[0].label).toBe("Jane Doe");
  });

  it("ranks largest files by size descending", () => {
    const assets = [buildTestAsset({ id: "a1", file_size: 100 }), buildTestAsset({ id: "a2", file_size: 900 })];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets, folders: [], downloads: [], views: [], favorites: [], shares: [], commentCountByAssetId: {}, clientNameByOwnerId: {}, unusedAssetIds: new Set(), now: NOW });
    expect(analytics.largestFiles[0].assetId).toBe("a2");
  });

  it("ranks most-viewed assets by view count", () => {
    const assets = [buildTestAsset({ id: "a1" }), buildTestAsset({ id: "a2" })];
    const views = [
      { id: "v1", workspace_id: "ws_1", asset_id: "a1", viewed_by: "m1", viewed_at: "2026-01-01T00:00:00.000Z" },
      { id: "v2", workspace_id: "ws_1", asset_id: "a2", viewed_by: "m1", viewed_at: "2026-01-01T00:00:00.000Z" },
      { id: "v3", workspace_id: "ws_1", asset_id: "a2", viewed_by: "m2", viewed_at: "2026-01-01T00:00:00.000Z" },
    ];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets, folders: [], downloads: [], views, favorites: [], shares: [], commentCountByAssetId: {}, clientNameByOwnerId: {}, unusedAssetIds: new Set(), now: NOW });
    expect(analytics.mostViewed[0].assetId).toBe("a2");
    expect(analytics.mostViewed[0].value).toBe(2);
  });

  it("counts only non-revoked shares", () => {
    const shares = [
      { id: "s1", workspace_id: "ws_1", asset_id: "a1", visibility: "team" as const, shared_by: "m1", shared_with_member_ids: [], note: null, created_at: "2026-01-01T00:00:00.000Z", revoked_at: null },
      { id: "s2", workspace_id: "ws_1", asset_id: "a1", visibility: "team" as const, shared_by: "m1", shared_with_member_ids: [], note: null, created_at: "2026-01-01T00:00:00.000Z", revoked_at: "2026-01-02T00:00:00.000Z" },
    ];
    const analytics = buildAssetAnalytics({ workspaceId: "ws_1", assets: [], folders: [], downloads: [], views: [], favorites: [], shares, commentCountByAssetId: {}, clientNameByOwnerId: {}, unusedAssetIds: new Set(), now: NOW });
    expect(analytics.totalShares).toBe(1);
  });
});
