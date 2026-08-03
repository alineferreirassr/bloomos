import { afterEach, describe, expect, it } from "vitest";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetMediaCollectionsStore } from "@/lib/data/mock/mediaCollectionsStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { mockKnowledgeGraphRepository, resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

afterEach(() => {
  resetMediaAssetsStore();
  resetMediaCollectionsStore();
  resetTimelineStore();
  resetKnowledgeGraphStore();
});

function makeFile(content: string, name: string, type: string): File {
  return new File([content], name, { type });
}

describe("Media Library <-> Knowledge Graph integration (Step 10)", () => {
  it("records a belongs_to relationship to the owner entity on upload", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    if (!upload.success) throw new Error("setup failed");

    const relationships = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(CURRENT_WORKSPACE_ID);
    const edge = relationships.find((r) => r.relationship_type === "belongs_to" && r.source_node_id === upload.data.id);
    expect(edge).toBeDefined();
    expect(edge?.target_node_type).toBe("event");
    expect(edge?.target_node_id).toBe("event_1");
    expect(edge?.source).toBe("asset_upload");
  });

  it("records an approved_by relationship when a real actorMemberId is given", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    if (!upload.success) throw new Error("setup failed");

    await mockMediaAssetsRepository.setMediaAssetStatus(upload.data.id, "approved", "Aline Ferreira", null, "member_1");

    const relationships = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(CURRENT_WORKSPACE_ID);
    const edge = relationships.find((r) => r.relationship_type === "approved_by" && r.source_node_id === upload.data.id);
    expect(edge).toBeDefined();
    expect(edge?.target_node_type).toBe("team_member");
    expect(edge?.target_node_id).toBe("member_1");
  });

  it("does not record an approval edge when no actorMemberId is given", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    if (!upload.success) throw new Error("setup failed");

    await mockMediaAssetsRepository.setMediaAssetStatus(upload.data.id, "approved", "Aline Ferreira");

    const relationships = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(CURRENT_WORKSPACE_ID);
    expect(relationships.some((r) => r.relationship_type === "approved_by")).toBe(false);
  });

  it("records and removes an included_in relationship for collection membership", async () => {
    const upload = await mockMediaAssetsRepository.uploadMediaAsset({
      ownerType: "event",
      ownerId: "event_1",
      file: makeFile("hello", "photo.jpg", "image/jpeg"),
      originalFilename: "photo.jpg",
    });
    const collection = await mockMediaAssetsRepository.createMediaCollection({ name: "Event Gallery" });
    if (!upload.success || !collection.success) throw new Error("setup failed");

    await mockMediaAssetsRepository.addAssetToCollection(collection.data.id, upload.data.id);
    let relationships = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(CURRENT_WORKSPACE_ID);
    expect(relationships.some((r) => r.relationship_type === "included_in" && r.source_node_id === upload.data.id && r.target_node_id === collection.data.id)).toBe(true);

    await mockMediaAssetsRepository.removeAssetFromCollection(collection.data.id, upload.data.id);
    relationships = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(CURRENT_WORKSPACE_ID);
    expect(relationships.some((r) => r.relationship_type === "included_in")).toBe(false);
  });
});
