import { describe, expect, it } from "vitest";
import { resolvePreviewType, buildAssetPreview } from "@/core/digitalAssets/previewEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";

describe("resolvePreviewType", () => {
  it("classifies images, video, audio, and PDF directly from mime type", () => {
    expect(resolvePreviewType({ mime_type: "image/png", extension: "png" })).toBe("image");
    expect(resolvePreviewType({ mime_type: "video/mp4", extension: "mp4" })).toBe("video");
    expect(resolvePreviewType({ mime_type: "audio/mpeg", extension: "mp3" })).toBe("audio");
    expect(resolvePreviewType({ mime_type: "application/pdf", extension: "pdf" })).toBe("pdf");
  });

  it("distinguishes plain text from other document types", () => {
    expect(resolvePreviewType({ mime_type: "text/plain", extension: "txt" })).toBe("text");
    expect(resolvePreviewType({ mime_type: "application/msword", extension: "doc" })).toBe("document");
  });

  it("classifies spreadsheets and presentations", () => {
    expect(resolvePreviewType({ mime_type: "application/vnd.ms-excel", extension: "xlsx" })).toBe("spreadsheet");
    expect(resolvePreviewType({ mime_type: "application/vnd.ms-powerpoint", extension: "pptx" })).toBe("presentation");
  });

  it("falls back to unknown for archives and unrecognized types", () => {
    expect(resolvePreviewType({ mime_type: "application/zip", extension: "zip" })).toBe("unknown");
    expect(resolvePreviewType({ mime_type: "application/octet-stream", extension: "bin" })).toBe("unknown");
  });
});

describe("buildAssetPreview", () => {
  it("marks image/pdf/video/audio/text as inline-renderable", () => {
    const asset = buildTestAsset({ mime_type: "image/jpeg", extension: "jpg" });
    const preview = buildAssetPreview(asset);
    expect(preview.canRenderInline).toBe(true);
  });

  it("marks unknown types as not inline-renderable", () => {
    const asset = buildTestAsset({ mime_type: "application/zip", extension: "zip" });
    const preview = buildAssetPreview(asset);
    expect(preview.canRenderInline).toBe(false);
  });

  it("never claims a thumbnail is available", () => {
    const asset = buildTestAsset({ mime_type: "image/jpeg", extension: "jpg" });
    expect(buildAssetPreview(asset).thumbnailAvailable).toBe(false);
  });
});
