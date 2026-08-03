import { describe, expect, it } from "vitest";
import { isMetadataComplete, summarizeAssetMetadata } from "@/core/digitalAssets/metadataEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";

describe("isMetadataComplete", () => {
  it("requires an author for every asset", () => {
    const asset = buildTestAsset({ metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} } });
    expect(isMetadataComplete(asset, "document")).toBe(false);
  });

  it("requires dimensions only for image/video preview types", () => {
    const withAuthor = buildTestAsset({ width: null, height: null, metadata: { pages: null, author: "Jane", license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} } });
    expect(isMetadataComplete(withAuthor, "audio")).toBe(true);
    expect(isMetadataComplete(withAuthor, "image")).toBe(false);
  });

  it("passes when author and (if applicable) dimensions are present", () => {
    const asset = buildTestAsset({ width: 800, height: 600, metadata: { pages: null, author: "Jane", license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} } });
    expect(isMetadataComplete(asset, "image")).toBe(true);
  });
});

describe("summarizeAssetMetadata", () => {
  it("formats file size, dimensions, and dates", () => {
    const asset = buildTestAsset({ file_size: 2 * 1024 * 1024, width: 1920, height: 1080 });
    const summary = summarizeAssetMetadata(asset, "image");
    expect(summary.fileSizeLabel).toContain("MB");
    expect(summary.dimensionsLabel).toBe("1920 × 1080");
    expect(summary.aspectRatio).toBe("16:9");
  });

  it("carries isComplete through from isMetadataComplete", () => {
    const asset = buildTestAsset({ metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} } });
    expect(summarizeAssetMetadata(asset, "document").isComplete).toBe(false);
  });
});
