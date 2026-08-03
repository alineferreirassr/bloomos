import { describe, expect, it } from "vitest";
import {
  extractFileExtension,
  isAllowedFileExtension,
  validateMimeType,
  validateFileSize,
  getFileSizeLimitBytes,
  generateStoredFilename,
  generateStoragePath,
  isSafeStoragePath,
} from "@/lib/media/mediaFile";
import { calculateChecksum } from "@/lib/media/checksum";

describe("extractFileExtension", () => {
  it("returns the lowercased extension without the dot", () => {
    expect(extractFileExtension("Photo.JPG")).toBe("jpg");
  });

  it("returns an empty string when there is no extension", () => {
    expect(extractFileExtension("README")).toBe("");
  });
});

describe("isAllowedFileExtension / validateMimeType", () => {
  it("allows a common image extension", () => {
    expect(isAllowedFileExtension("png")).toBe(true);
    expect(validateMimeType("image/png", "png").valid).toBe(true);
  });

  it("blocks an executable extension even if it's not on any allowlist check path", () => {
    expect(isAllowedFileExtension("exe")).toBe(false);
    expect(validateMimeType("application/octet-stream", "exe").valid).toBe(false);
  });

  it("rejects an unrecognized extension", () => {
    expect(isAllowedFileExtension("xyz123")).toBe(false);
  });

  it("rejects a missing/malformed MIME type", () => {
    expect(validateMimeType("", "png").valid).toBe(false);
    expect(validateMimeType("not-a-mime", "png").valid).toBe(false);
  });
});

describe("validateFileSize", () => {
  it("accepts a file within the image size limit", () => {
    expect(validateFileSize(1024, "image/png").valid).toBe(true);
  });

  it("rejects a zero-byte file", () => {
    const result = validateFileSize(0, "image/png");
    expect(result.valid).toBe(false);
  });

  it("rejects a file over the limit for its MIME category", () => {
    const limit = getFileSizeLimitBytes("image/png");
    const result = validateFileSize(limit + 1, "image/png");
    expect(result.valid).toBe(false);
  });

  it("gives video a larger limit than image", () => {
    expect(getFileSizeLimitBytes("video/mp4")).toBeGreaterThan(getFileSizeLimitBytes("image/png"));
  });
});

describe("generateStoredFilename", () => {
  it("normalizes unsafe characters and lowercases the extension", () => {
    expect(generateStoredFilename("My Photo (Final)!!.JPG")).toBe("my-photo-final.jpg");
  });

  it("falls back to a safe base name when nothing survives normalization", () => {
    expect(generateStoredFilename("!!!.png")).toBe("file.png");
  });
});

describe("generateStoragePath", () => {
  it("embeds workspace/owner/asset/version/filename in order", () => {
    const path = generateStoragePath({
      workspaceId: "ws_1",
      ownerType: "event",
      ownerId: "event_1",
      mediaAssetId: "media_1",
      version: 2,
      storedFilename: "photo.jpg",
    });
    expect(path).toBe("ws_1/event/event_1/media_1/v2/photo.jpg");
  });
});

describe("isSafeStoragePath", () => {
  it("accepts a normal relative path", () => {
    expect(isSafeStoragePath("ws_1/event/event_1/media_1/v1/photo.jpg")).toBe(true);
  });

  it("rejects a leading slash", () => {
    expect(isSafeStoragePath("/etc/passwd")).toBe(false);
  });

  it("rejects a path traversal segment", () => {
    expect(isSafeStoragePath("ws_1/../secrets")).toBe(false);
  });
});

describe("calculateChecksum", () => {
  it("produces a stable sha256-prefixed digest for the same bytes", async () => {
    const bytes = new TextEncoder().encode("hello media library").buffer;
    const checksum = await calculateChecksum(bytes);
    expect(checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(await calculateChecksum(bytes)).toBe(checksum);
  });

  it("produces a different digest for different bytes", async () => {
    const a = await calculateChecksum(new TextEncoder().encode("a").buffer);
    const b = await calculateChecksum(new TextEncoder().encode("b").buffer);
    expect(a).not.toBe(b);
  });
});
