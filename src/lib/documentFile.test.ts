import { describe, expect, it } from "vitest";
import {
  normalizeFileName,
  extractFileExtension,
  isAllowedFileExtension,
  isBlockedFileExtension,
  validateMimeType,
  validateFileSize,
  getFileSizeLimitBytes,
  generateStoragePath,
  generateDocumentTitle,
  calculateMockChecksum,
  isSafeStoragePath,
  FILE_SIZE_LIMITS_BYTES,
  ALLOWED_FILE_EXTENSIONS,
  BLOCKED_FILE_EXTENSIONS,
} from "@/lib/documentFile";

describe("normalizeFileName", () => {
  it("lowercases the extension and strips unsafe characters", () => {
    expect(normalizeFileName("My Contract (Final).PDF")).toBe("my_contract_final.pdf");
  });

  it("collapses repeated separators", () => {
    expect(normalizeFileName("a   b---c.pdf")).toBe("a_b_c.pdf");
  });

  it("falls back to 'untitled' for an all-unsafe base name", () => {
    expect(normalizeFileName("!!!.pdf")).toBe("untitled.pdf");
  });

  it("handles a file with no extension", () => {
    expect(normalizeFileName("README")).toBe("readme");
  });
});

describe("extractFileExtension", () => {
  it("returns the lowercase extension without the dot", () => {
    expect(extractFileExtension("Report.PDF")).toBe("pdf");
  });

  it("returns an empty string when there is no extension", () => {
    expect(extractFileExtension("README")).toBe("");
  });

  it("returns an empty string for a dotfile with nothing after the dot", () => {
    expect(extractFileExtension("file.")).toBe("");
  });

  it("uses only the final segment for a multi-dot file name", () => {
    expect(extractFileExtension("archive.tar.zip")).toBe("zip");
  });
});

describe("isAllowedFileExtension / isBlockedFileExtension", () => {
  it("accepts every extension in the allow list", () => {
    for (const extension of ALLOWED_FILE_EXTENSIONS) {
      expect(isAllowedFileExtension(extension)).toBe(true);
    }
  });

  it("rejects every extension in the block list, and never allows one", () => {
    for (const extension of BLOCKED_FILE_EXTENSIONS) {
      expect(isBlockedFileExtension(extension)).toBe(true);
      expect(isAllowedFileExtension(extension)).toBe(false);
    }
  });

  it("rejects an unknown extension", () => {
    expect(isAllowedFileExtension("xyz")).toBe(false);
    expect(isBlockedFileExtension("xyz")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAllowedFileExtension("PDF")).toBe(true);
    expect(isBlockedFileExtension("EXE")).toBe(true);
  });
});

describe("validateMimeType", () => {
  it("accepts a matching MIME type for a known extension", () => {
    expect(validateMimeType("application/pdf", "pdf").valid).toBe(true);
  });

  it("rejects a mismatched MIME type", () => {
    const result = validateMimeType("image/png", "pdf");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match");
  });

  it("rejects a blocked extension regardless of MIME type", () => {
    const result = validateMimeType("application/x-msdownload", "exe");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  it("rejects an unsupported extension", () => {
    const result = validateMimeType("application/octet-stream", "xyz");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not supported");
  });
});

describe("validateFileSize", () => {
  it("accepts a size within the limit for its category", () => {
    expect(validateFileSize(1_000_000, "pdf").valid).toBe(true);
  });

  it("rejects a size over the PDF limit (50MB)", () => {
    expect(validateFileSize(51 * 1024 * 1024, "pdf").valid).toBe(false);
  });

  it("rejects a size over the image limit (25MB) even though it would pass the PDF limit", () => {
    expect(validateFileSize(30 * 1024 * 1024, "jpg").valid).toBe(false);
  });

  it("accepts a large video within its 500MB limit", () => {
    expect(validateFileSize(400 * 1024 * 1024, "mp4").valid).toBe(true);
  });

  it("rejects zero or negative sizes", () => {
    expect(validateFileSize(0, "pdf").valid).toBe(false);
    expect(validateFileSize(-100, "pdf").valid).toBe(false);
  });

  it("rejects a non-integer size", () => {
    expect(validateFileSize(100.5, "pdf").valid).toBe(false);
  });
});

describe("getFileSizeLimitBytes", () => {
  it("returns the per-category limits", () => {
    expect(getFileSizeLimitBytes("jpg")).toBe(FILE_SIZE_LIMITS_BYTES.IMAGE);
    expect(getFileSizeLimitBytes("pdf")).toBe(FILE_SIZE_LIMITS_BYTES.PDF);
    expect(getFileSizeLimitBytes("docx")).toBe(FILE_SIZE_LIMITS_BYTES.OFFICE);
    expect(getFileSizeLimitBytes("mp4")).toBe(FILE_SIZE_LIMITS_BYTES.VIDEO);
    expect(getFileSizeLimitBytes("zip")).toBe(FILE_SIZE_LIMITS_BYTES.ARCHIVE);
  });

  it("falls back to the default limit for an unrecognized extension", () => {
    expect(getFileSizeLimitBytes("xyz")).toBe(FILE_SIZE_LIMITS_BYTES.FALLBACK);
  });
});

describe("generateStoragePath", () => {
  it("builds a deterministic, relative, normalized path", () => {
    expect(
      generateStoragePath({ workspaceId: "ws_1", ownerType: "client", ownerId: "client_1", fileName: "Contract.pdf" }),
    ).toBe("ws_1/client/client_1/contract.pdf");
  });

  it("is always safe (no leading slash, no traversal)", () => {
    const path = generateStoragePath({
      workspaceId: "ws_1",
      ownerType: "client",
      ownerId: "client_1",
      fileName: "../../etc/passwd",
    });
    expect(isSafeStoragePath(path)).toBe(true);
  });
});

describe("isSafeStoragePath", () => {
  it("rejects a leading slash", () => {
    expect(isSafeStoragePath("/etc/passwd")).toBe(false);
  });

  it("rejects .. traversal", () => {
    expect(isSafeStoragePath("ws_1/client/../other/file.pdf")).toBe(false);
  });

  it("accepts a normal relative path", () => {
    expect(isSafeStoragePath("ws_1/client/client_1/file.pdf")).toBe(true);
  });
});

describe("generateDocumentTitle", () => {
  it("title-cases a snake_case/kebab-case file name", () => {
    expect(generateDocumentTitle("signed_contract-v2.pdf")).toBe("Signed Contract V2");
  });

  it("falls back to 'Untitled Document' for an all-unsafe base name", () => {
    expect(generateDocumentTitle("___.pdf")).toBe("Untitled Document");
  });
});

describe("calculateMockChecksum", () => {
  it("is deterministic for the same inputs", () => {
    expect(calculateMockChecksum("contract.pdf", 204800)).toBe(calculateMockChecksum("contract.pdf", 204800));
  });

  it("differs when the file name or size differs", () => {
    expect(calculateMockChecksum("contract.pdf", 204800)).not.toBe(calculateMockChecksum("contract.pdf", 204801));
    expect(calculateMockChecksum("contract.pdf", 204800)).not.toBe(calculateMockChecksum("other.pdf", 204800));
  });
});
