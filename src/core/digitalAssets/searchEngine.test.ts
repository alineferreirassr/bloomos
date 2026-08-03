import { describe, expect, it } from "vitest";
import { searchAssets } from "@/core/digitalAssets/searchEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";

describe("searchAssets", () => {
  it("matches by filename query, case-insensitively", () => {
    const assets = [buildTestAsset({ id: "a1", original_filename: "Wedding-Photo.jpg" }), buildTestAsset({ id: "a2", original_filename: "invoice.pdf" })];
    const results = searchAssets(assets, { query: "wedding" });
    expect(results.map((r) => r.asset.id)).toEqual(["a1"]);
    expect(results[0].matchedFields).toContain("filename");
  });

  it("matches by tags", () => {
    const assets = [buildTestAsset({ id: "a1", tags: ["brand-kit"] }), buildTestAsset({ id: "a2", tags: [] })];
    const results = searchAssets(assets, { query: "brand" });
    expect(results.map((r) => r.asset.id)).toEqual(["a1"]);
  });

  it("filters by ownerType and ownerId", () => {
    const assets = [buildTestAsset({ id: "a1", owner_type: "client", owner_id: "client_1" }), buildTestAsset({ id: "a2", owner_type: "client", owner_id: "client_2" })];
    const results = searchAssets(assets, { ownerType: "client", ownerId: "client_1" });
    expect(results.map((r) => r.asset.id)).toEqual(["a1"]);
  });

  it("filters by favoriteOnly using the provided favorite id set", () => {
    const assets = [buildTestAsset({ id: "a1" }), buildTestAsset({ id: "a2" })];
    const results = searchAssets(assets, { favoriteOnly: true }, [], new Set(["a2"]));
    expect(results.map((r) => r.asset.id)).toEqual(["a2"]);
  });

  it("filters by folderId, including null (unfiled)", () => {
    const assets = [buildTestAsset({ id: "a1", folder_id: "folder_1" }), buildTestAsset({ id: "a2", folder_id: null })];
    expect(searchAssets(assets, { folderId: null }).map((r) => r.asset.id)).toEqual(["a2"]);
    expect(searchAssets(assets, { folderId: "folder_1" }).map((r) => r.asset.id)).toEqual(["a1"]);
  });

  it("filters by a required tag set (every tag must match)", () => {
    const assets = [buildTestAsset({ id: "a1", tags: ["brand", "logo"] }), buildTestAsset({ id: "a2", tags: ["brand"] })];
    const results = searchAssets(assets, { tags: ["brand", "logo"] });
    expect(results.map((r) => r.asset.id)).toEqual(["a1"]);
  });

  it("returns every asset when no filters are given", () => {
    const assets = [buildTestAsset({ id: "a1" }), buildTestAsset({ id: "a2" })];
    expect(searchAssets(assets, {})).toHaveLength(2);
  });
});
