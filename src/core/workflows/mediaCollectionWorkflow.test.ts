import { describe, expect, it } from "vitest";
import { resolveCollectionAssets } from "@/core/workflows/mediaCollectionWorkflow";
import type { MediaAsset } from "@/types/mediaAsset";
import type { MediaCollection } from "@/types/mediaCollection";

function makeAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, "id">): MediaAsset {
  return {
    workspace_id: "ws_1",
    owner_type: "event",
    owner_id: "event_1",
    original_filename: `${overrides.id}.jpg`,
    stored_filename: `${overrides.id}.jpg`,
    storage_bucket: "media-assets",
    storage_path: `ws_1/event/event_1/${overrides.id}/1/${overrides.id}.jpg`,
    mime_type: "image/jpeg",
    extension: "jpg",
    file_size: 100,
    checksum: "abc",
    width: null,
    height: null,
    duration: null,
    version: 1,
    uploaded_by: null,
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

function makeCollection(overrides: Partial<MediaCollection> & Pick<MediaCollection, "id">): MediaCollection {
  return {
    workspace_id: "ws_1",
    name: overrides.id,
    description: null,
    kind: "manual",
    template: null,
    asset_ids: [],
    smart_rule: null,
    is_favorite: false,
    is_pinned: false,
    shared_with_member_ids: [],
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveCollectionAssets", () => {
  it("returns asset_ids members for a manual collection", () => {
    const asset1 = makeAsset({ id: "a1" });
    const asset2 = makeAsset({ id: "a2" });
    const collection = makeCollection({ id: "c1", kind: "manual", asset_ids: ["a1"] });
    expect(resolveCollectionAssets(collection, [asset1, asset2]).map((a) => a.id)).toEqual(["a1"]);
  });

  it("excludes archived assets even if they are members", () => {
    const asset1 = makeAsset({ id: "a1", archived_at: "2026-02-01T00:00:00.000Z" });
    const collection = makeCollection({ id: "c1", kind: "manual", asset_ids: ["a1"] });
    expect(resolveCollectionAssets(collection, [asset1])).toEqual([]);
  });

  it("computes membership from smart_rule for a smart collection", () => {
    const matching = makeAsset({ id: "a1", tags: ["wedding", "gallery"], ai_ready: true });
    const nonMatching = makeAsset({ id: "a2", tags: ["vendor"] });
    const collection = makeCollection({ id: "c1", kind: "smart", smart_rule: { requiredTags: ["wedding"], aiReadyOnly: true } });
    expect(resolveCollectionAssets(collection, [matching, nonMatching]).map((a) => a.id)).toEqual(["a1"]);
  });

  it("matches on color_label when specified", () => {
    const red = makeAsset({ id: "a1", color_label: "red" });
    const blue = makeAsset({ id: "a2", color_label: "blue" });
    const collection = makeCollection({ id: "c1", kind: "smart", smart_rule: { colorLabel: "red" } });
    expect(resolveCollectionAssets(collection, [red, blue]).map((a) => a.id)).toEqual(["a1"]);
  });

  it("returns nothing for a smart collection with no rule", () => {
    const asset = makeAsset({ id: "a1" });
    const collection = makeCollection({ id: "c1", kind: "smart", smart_rule: null });
    expect(resolveCollectionAssets(collection, [asset])).toEqual([]);
  });
});
