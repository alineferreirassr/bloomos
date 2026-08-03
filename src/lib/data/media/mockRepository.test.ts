import { afterEach, describe, expect, it } from "vitest";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { NotFoundError } from "@/core/errors";

afterEach(() => {
  resetMediaAssetsStore();
  resetTimelineStore();
});

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("mockMediaAssetsRepository.uploadMediaAsset", () => {
  it("rejects an owner type that isn't live yet", async () => {
    const result = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "contract",
      ownerId: "contract_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("accepts owner type 'vendor' now that it's live", async () => {
    const result = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "vendor",
      ownerId: "vendor_1",
      file: makeFile("hello", "w9-form.pdf", "application/pdf"),
      originalFilename: "w9-form.pdf",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.owner_type).toBe("vendor");
      expect(result.data.owner_id).toBe("vendor_1");
    }
  });

  it("rejects a blocked/unsupported extension", async () => {
    const result = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("MZ", "installer.exe", "application/octet-stream"),
      originalFilename: "installer.exe",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an oversized file for its MIME category", async () => {
    const oversized = "x".repeat(30 * 1024 * 1024); // over the 25MB image limit
    const result = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile(oversized, "huge.png", "image/png"),
      originalFilename: "huge.png",
    });
    expect(result.success).toBe(false);
  });

  it("creates a media asset with a real checksum, version 1, and a versioned storage path", async () => {
    const result = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello media library", "Photo Final.JPG", "image/jpeg"),
      originalFilename: "Photo Final.JPG",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.owner_type).toBe("event");
    expect(result.data.owner_id).toBe("event_1");
    expect(result.data.version).toBe(1);
    expect(result.data.extension).toBe("jpg");
    expect(result.data.stored_filename).toBe("photo-final.jpg");
    expect(result.data.storage_path).toContain(`/${result.data.id}/v1/`);
    expect(result.data.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.data.archived_at).toBeNull();

    const activities = readActivities().filter((a) => a.owner_id === "event_1" && a.type === "media_asset_uploaded");
    expect(activities).toHaveLength(1);
  });
});

describe("mockMediaAssetsRepository.getMediaAssetById / getMediaAssetsByOwner", () => {
  it("throws NotFoundError for an unknown id", async () => {
    await expect(mockMediaAssetsRepository.getMediaAssetById("nope")).rejects.toThrow(NotFoundError);
  });

  it("lists assets scoped to an owner and excludes archived by default", async () => {
    const uploaded = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "lead",
      ownerId: "lead_1",
      file: makeFile("a", "a.png", "image/png"),
      originalFilename: "a.png",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "lead",
      ownerId: "lead_2",
      file: makeFile("b", "b.png", "image/png"),
      originalFilename: "b.png",
    });

    let list = await mockMediaAssetsRepository.getMediaAssetsByOwner("lead", "lead_1");
    expect(list.map((a) => a.id)).toEqual([uploaded.data.id]);

    await mockMediaAssetsRepository.deleteMediaAsset(uploaded.data.id);
    list = await mockMediaAssetsRepository.getMediaAssetsByOwner("lead", "lead_1");
    expect(list).toHaveLength(0);

    list = await mockMediaAssetsRepository.getMediaAssetsByOwner("lead", "lead_1", { includeArchived: true });
    expect(list).toHaveLength(1);
  });
});

describe("mockMediaAssetsRepository.replaceMediaAssetVersion", () => {
  it("fails for an unknown asset", async () => {
    const result = await mockMediaAssetsRepository.replaceMediaAssetVersion("nope", {
      file: makeFile("x", "x.png", "image/png"),
      originalFilename: "x.png",
    });
    expect(result.success).toBe(false);
  });

  it("increments version, updates checksum/path, and refuses on an archived asset", async () => {
    const uploaded = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("v1 bytes", "doc.pdf", "application/pdf"),
      originalFilename: "doc.pdf",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    const replaced = await mockMediaAssetsRepository.replaceMediaAssetVersion(uploaded.data.id, {
      file: makeFile("v2 bytes, different content", "doc-v2.pdf", "application/pdf"),
      originalFilename: "doc-v2.pdf",
    });
    expect(replaced.success).toBe(true);
    if (!replaced.success) return;
    expect(replaced.data.version).toBe(2);
    expect(replaced.data.checksum).not.toBe(uploaded.data.checksum);
    expect(replaced.data.storage_path).toContain(`/${uploaded.data.id}/v2/`);
    expect(replaced.data.storage_path).not.toBe(uploaded.data.storage_path);

    await mockMediaAssetsRepository.deleteMediaAsset(uploaded.data.id);
    const afterArchive = await mockMediaAssetsRepository.replaceMediaAssetVersion(uploaded.data.id, {
      file: makeFile("v3", "doc-v3.pdf", "application/pdf"),
      originalFilename: "doc-v3.pdf",
    });
    expect(afterArchive.success).toBe(false);
  });
});

describe("mockMediaAssetsRepository.downloadMediaAsset / getMediaAssetDownloadUrl / verifyMediaAssetChecksum", () => {
  it("round-trips the exact uploaded bytes and verifies checksum integrity", async () => {
    const uploaded = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "client",
      ownerId: "client_1",
      file: makeFile("round trip bytes", "note.txt", "text/plain"),
      originalFilename: "note.txt",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    const download = await mockMediaAssetsRepository.downloadMediaAsset(uploaded.data.id);
    expect(download.success).toBe(true);
    if (!download.success) return;
    expect(await download.data.blob.text()).toBe("round trip bytes");

    const urlResult = await mockMediaAssetsRepository.getMediaAssetDownloadUrl(uploaded.data.id);
    expect(urlResult.success).toBe(true);
    if (!urlResult.success) return;
    expect(urlResult.data.url).toContain(uploaded.data.storage_path);

    const verification = await mockMediaAssetsRepository.verifyMediaAssetChecksum(uploaded.data.id);
    expect(verification.success).toBe(true);
    if (!verification.success) return;
    expect(verification.data.valid).toBe(true);
    expect(verification.data.expectedChecksum).toBe(verification.data.actualChecksum);
  });
});

describe("mockMediaAssetsRepository.deleteMediaAsset / restoreMediaAsset", () => {
  it("archives then restores, guarding against double-archive and double-restore", async () => {
    const uploaded = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_9",
      file: makeFile("x", "x.png", "image/png"),
      originalFilename: "x.png",
    });
    expect(uploaded.success).toBe(true);
    if (!uploaded.success) return;

    const archived = await mockMediaAssetsRepository.deleteMediaAsset(uploaded.data.id);
    expect(archived.success).toBe(true);
    if (!archived.success) return;
    expect(archived.data.archived_at).not.toBeNull();

    const doubleArchive = await mockMediaAssetsRepository.deleteMediaAsset(uploaded.data.id);
    expect(doubleArchive.success).toBe(false);

    const restored = await mockMediaAssetsRepository.restoreMediaAsset(uploaded.data.id);
    expect(restored.success).toBe(true);
    if (!restored.success) return;
    expect(restored.data.archived_at).toBeNull();

    const doubleRestore = await mockMediaAssetsRepository.restoreMediaAsset(uploaded.data.id);
    expect(doubleRestore.success).toBe(false);

    const activityTypes = readActivities()
      .filter((a) => a.owner_id === "event_9")
      .map((a) => a.type);
    expect(activityTypes).toEqual(
      expect.arrayContaining(["media_asset_uploaded", "media_asset_archived", "media_asset_restored"]),
    );
  });
});
