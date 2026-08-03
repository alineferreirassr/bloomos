import { describe, expect, it } from "vitest";
import { categorizeAsset } from "@/modules/assets/assetCategory";

describe("categorizeAsset", () => {
  it("categorizes images, video, audio, and pdf by MIME type", () => {
    expect(categorizeAsset({ mime_type: "image/jpeg", extension: "jpg" })).toBe("image");
    expect(categorizeAsset({ mime_type: "video/mp4", extension: "mp4" })).toBe("video");
    expect(categorizeAsset({ mime_type: "audio/mpeg", extension: "mp3" })).toBe("audio");
    expect(categorizeAsset({ mime_type: "application/pdf", extension: "pdf" })).toBe("pdf");
  });

  it("categorizes office formats", () => {
    expect(categorizeAsset({ mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx" })).toBe("document");
    expect(categorizeAsset({ mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" })).toBe("spreadsheet");
    expect(categorizeAsset({ mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx" })).toBe("presentation");
  });

  it("categorizes 3D files and archives by extension", () => {
    expect(categorizeAsset({ mime_type: "application/octet-stream", extension: "glb" })).toBe("3d");
    expect(categorizeAsset({ mime_type: "application/zip", extension: "zip" })).toBe("archive");
  });

  it("falls back to other for unrecognized types", () => {
    expect(categorizeAsset({ mime_type: "application/octet-stream", extension: "bin" })).toBe("other");
  });
});
