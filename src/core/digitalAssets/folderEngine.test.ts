import { describe, expect, it } from "vitest";
import { canDeleteFolder, buildFolderTree } from "@/core/digitalAssets/folderEngine";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaAsset } from "@/types/mediaAsset";

function folder(overrides: Partial<MediaFolder> = {}): MediaFolder {
  return {
    id: "folder_1",
    workspace_id: "ws_1",
    owner_type: null,
    owner_id: null,
    parent_folder_id: null,
    name: "Root",
    sort_order: 0,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "asset_1",
    workspace_id: "ws_1",
    owner_type: "workspace",
    owner_id: "ws_1",
    original_filename: "photo.jpg",
    stored_filename: "photo_stored.jpg",
    storage_bucket: "assets",
    storage_path: "ws_1/photo.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 1024,
    checksum: "abc123",
    width: 800,
    height: 600,
    duration: null,
    version: 1,
    uploaded_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    folder_id: null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
    ...overrides,
  };
}

describe("canDeleteFolder", () => {
  it("allows deleting an empty folder", () => {
    const check = canDeleteFolder("folder_1", [folder()], []);
    expect(check.allowed).toBe(true);
  });

  it("blocks deleting a folder with active child folders", () => {
    const child = folder({ id: "folder_2", parent_folder_id: "folder_1" });
    const check = canDeleteFolder("folder_1", [folder(), child], []);
    expect(check.allowed).toBe(false);
    expect(check.blockingChildFolderCount).toBe(1);
  });

  it("blocks deleting a folder with active assets filed in it", () => {
    const filedAsset = asset({ folder_id: "folder_1" });
    const check = canDeleteFolder("folder_1", [folder()], [filedAsset]);
    expect(check.allowed).toBe(false);
    expect(check.blockingAssetCount).toBe(1);
  });

  it("ignores archived child folders and archived assets", () => {
    const archivedChild = folder({ id: "folder_2", parent_folder_id: "folder_1", archived_at: "2026-01-02T00:00:00.000Z" });
    const archivedAsset = asset({ folder_id: "folder_1", archived_at: "2026-01-02T00:00:00.000Z" });
    const check = canDeleteFolder("folder_1", [folder(), archivedChild], [archivedAsset]);
    expect(check.allowed).toBe(true);
  });
});

describe("buildFolderTree", () => {
  it("builds a nested tree with per-folder asset counts", () => {
    const root = folder({ id: "folder_1", name: "Brand" });
    const child = folder({ id: "folder_2", name: "Logos", parent_folder_id: "folder_1" });
    const assets = [asset({ id: "a1", folder_id: "folder_2" }), asset({ id: "a2", folder_id: "folder_2" })];

    const tree = buildFolderTree(null, [root, child], assets);

    expect(tree).toHaveLength(1);
    expect(tree[0].folder.name).toBe("Brand");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].folder.name).toBe("Logos");
    expect(tree[0].children[0].assetCount).toBe(2);
  });
});
