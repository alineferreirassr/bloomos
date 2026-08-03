import { afterEach, describe, expect, it } from "vitest";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetMediaFoldersStore } from "@/lib/data/mock/mediaFoldersStore";
import { resetMediaCollectionsStore } from "@/lib/data/mock/mediaCollectionsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";

afterEach(() => {
  resetMediaAssetsStore();
  resetMediaFoldersStore();
  resetMediaCollectionsStore();
  resetTimelineStore();
});

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("Media Folders", () => {
  it("creates a workspace-wide folder and records a Timeline activity", async () => {
    const result = await mockMediaAssetsRepository.createMediaFolder({ name: "Brand Assets" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_type).toBeNull();
    expect(result.data.parent_folder_id).toBeNull();

    const activities = readActivities().filter((a) => a.type === "media_folder_created");
    expect(activities).toHaveLength(1);
  });

  it("rejects an empty name", async () => {
    const result = await mockMediaAssetsRepository.createMediaFolder({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("refuses a sub-folder whose owner doesn't match its parent", async () => {
    const parent = await mockMediaAssetsRepository.createMediaFolder({ name: "Parent", ownerType: "event", ownerId: "event_1" });
    expect(parent.success).toBe(true);
    if (!parent.success) return;

    const child = await mockMediaAssetsRepository.createMediaFolder({ name: "Child", ownerType: "event", ownerId: "event_2", parentFolderId: parent.data.id });
    expect(child.success).toBe(false);
  });

  it("moves a folder, refusing a cycle", async () => {
    const a = await mockMediaAssetsRepository.createMediaFolder({ name: "A" });
    const b = await mockMediaAssetsRepository.createMediaFolder({ name: "B" });
    if (!a.success || !b.success) throw new Error("setup failed");

    const moveB = await mockMediaAssetsRepository.moveMediaFolder(b.data.id, a.data.id);
    expect(moveB.success).toBe(true);

    const cyclic = await mockMediaAssetsRepository.moveMediaFolder(a.data.id, b.data.id);
    expect(cyclic.success).toBe(false);
  });

  it("archives and restores a folder", async () => {
    const created = await mockMediaAssetsRepository.createMediaFolder({ name: "Old Season" });
    if (!created.success) throw new Error("setup failed");

    const archived = await mockMediaAssetsRepository.archiveMediaFolder(created.data.id);
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const listWithoutArchived = await mockMediaAssetsRepository.getMediaFolders();
    expect(listWithoutArchived.find((f) => f.id === created.data.id)).toBeUndefined();

    const restored = await mockMediaAssetsRepository.restoreMediaFolder(created.data.id);
    expect(restored.success).toBe(true);
    if (restored.success) expect(restored.data.archived_at).toBeNull();
  });

  it("moving an asset into a folder records media_asset_moved_to_folder", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    const folder = await mockMediaAssetsRepository.createMediaFolder({ name: "Gallery", ownerType: "event", ownerId: "event_1" });
    if (!upload.success || !folder.success) throw new Error("setup failed");

    const moved = await mockMediaAssetsRepository.setMediaAssetFolder(upload.data.id, folder.data.id);
    expect(moved.success).toBe(true);
    if (moved.success) expect(moved.data.folder_id).toBe(folder.data.id);

    const activities = readActivities().filter((a) => a.type === "media_asset_moved_to_folder");
    expect(activities).toHaveLength(1);
  });
});

describe("Media Collections", () => {
  it("creates a manual collection and records a Timeline activity", async () => {
    const result = await mockMediaAssetsRepository.createMediaCollection({ name: "Wedding Collection", template: "wedding_collection" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.kind).toBe("manual");
    expect(result.data.asset_ids).toEqual([]);

    const activities = readActivities().filter((a) => a.type === "media_collection_created");
    expect(activities).toHaveLength(1);
  });

  it("adds and removes an asset from a collection idempotently", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    const collection = await mockMediaAssetsRepository.createMediaCollection({ name: "Event Gallery" });
    if (!upload.success || !collection.success) throw new Error("setup failed");

    const added = await mockMediaAssetsRepository.addAssetToCollection(collection.data.id, upload.data.id);
    expect(added.success).toBe(true);
    if (added.success) expect(added.data.asset_ids).toEqual([upload.data.id]);

    // Adding the same asset again is a no-op, not a duplicate.
    const addedAgain = await mockMediaAssetsRepository.addAssetToCollection(collection.data.id, upload.data.id);
    expect(addedAgain.success).toBe(true);
    if (addedAgain.success) expect(addedAgain.data.asset_ids).toEqual([upload.data.id]);

    const removed = await mockMediaAssetsRepository.removeAssetFromCollection(collection.data.id, upload.data.id);
    expect(removed.success).toBe(true);
    if (removed.success) expect(removed.data.asset_ids).toEqual([]);
  });

  it("toggles favorite and pinned", async () => {
    const created = await mockMediaAssetsRepository.createMediaCollection({ name: "Brand Kit" });
    if (!created.success) throw new Error("setup failed");

    const favorited = await mockMediaAssetsRepository.toggleMediaCollectionFavorite(created.data.id);
    expect(favorited.success).toBe(true);
    if (favorited.success) expect(favorited.data.is_favorite).toBe(true);

    const pinned = await mockMediaAssetsRepository.toggleMediaCollectionPinned(created.data.id);
    expect(pinned.success).toBe(true);
    if (pinned.success) expect(pinned.data.is_pinned).toBe(true);
  });

  it("deletes a collection", async () => {
    const created = await mockMediaAssetsRepository.createMediaCollection({ name: "Temp" });
    if (!created.success) throw new Error("setup failed");

    const deleted = await mockMediaAssetsRepository.deleteMediaCollection(created.data.id);
    expect(deleted.success).toBe(true);

    const list = await mockMediaAssetsRepository.getMediaCollections();
    expect(list.find((c) => c.id === created.data.id)).toBeUndefined();
  });

  it("rejects an empty collection name", async () => {
    const result = await mockMediaAssetsRepository.createMediaCollection({ name: "" });
    expect(result.success).toBe(false);
  });
});
