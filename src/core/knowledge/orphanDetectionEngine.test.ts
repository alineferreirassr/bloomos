import { describe, expect, it } from "vitest";
import { detectOrphanedAssets, findDuplicateRelationships } from "@/core/knowledge/orphanDetectionEngine";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";
import type { MediaAsset } from "@/types/mediaAsset";

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

function makeRel(overrides: Partial<KnowledgeRelationship> & Pick<KnowledgeRelationship, "source_node_type" | "source_node_id" | "target_node_type" | "target_node_id" | "relationship_type">): KnowledgeRelationship {
  return {
    id: `rel_${Math.random()}`,
    workspace_id: "ws_1",
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    status: "active",
    confidence: 100,
    source: "user_action",
    notes: null,
    metadata: {},
    start_date: null,
    end_date: null,
    semantics: null,
    ...overrides,
  };
}

describe("detectOrphanedAssets", () => {
  it("flags an asset with no relationships at all", () => {
    const asset = makeAsset({ id: "a1" });
    const findings = detectOrphanedAssets({ assets: [asset], relationships: [], existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings.some((f) => f.reason === "no_relationships")).toBe(true);
  });

  it("flags an asset whose owner entity no longer exists", () => {
    const asset = makeAsset({ id: "a1", owner_type: "event", owner_id: "deleted_event" });
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "deleted_event", target_node_type: "media_asset", target_node_id: "a1", relationship_type: "used_by" })];
    const findings = detectOrphanedAssets({ assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings.some((f) => f.reason === "linked_to_deleted_entity")).toBe(true);
  });

  it("does not flag linked_to_deleted_entity when the owner key exists", () => {
    const asset = makeAsset({ id: "a1", owner_type: "event", owner_id: "event_1" });
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "media_asset", target_node_id: "a1", relationship_type: "used_by" })];
    const findings = detectOrphanedAssets({ assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings.some((f) => f.reason === "linked_to_deleted_entity")).toBe(false);
  });

  it("flags an archived asset that still has inbound references", () => {
    const asset = makeAsset({ id: "a1", archived_at: "2026-02-01T00:00:00.000Z" });
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "media_asset", target_node_id: "a1", relationship_type: "used_by" })];
    const findings = detectOrphanedAssets({ assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings.some((f) => f.reason === "archived_but_referenced")).toBe(true);
  });

  it("flags a reference that snapshotted an older version than the asset's current version", () => {
    const asset = makeAsset({ id: "a1", version: 3 });
    const relationships = [
      makeRel({
        source_node_type: "proposal",
        source_node_id: "proposal_1",
        target_node_type: "media_asset",
        target_node_id: "a1",
        relationship_type: "used_by",
        metadata: { assetVersion: "1" },
      }),
    ];
    const findings = detectOrphanedAssets({ assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings.some((f) => f.reason === "superseded_version_still_referenced")).toBe(true);
  });

  it("finds nothing wrong with a healthy, current, referenced asset", () => {
    const asset = makeAsset({ id: "a1", version: 1 });
    const relationships = [
      makeRel({
        source_node_type: "event",
        source_node_id: "event_1",
        target_node_type: "media_asset",
        target_node_id: "a1",
        relationship_type: "used_by",
        metadata: { assetVersion: "1" },
      }),
    ];
    const findings = detectOrphanedAssets({ assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1"]) });
    expect(findings).toEqual([]);
  });
});

describe("findDuplicateRelationships", () => {
  it("groups exact-match active duplicates", () => {
    const relationships = [
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" }),
    ];
    const groups = findDuplicateRelationships(relationships);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it("does not treat archived rows as duplicates of an active one", () => {
    const relationships = [
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to", status: "active" }),
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to", status: "archived" }),
    ];
    expect(findDuplicateRelationships(relationships)).toEqual([]);
  });

  it("returns nothing when there are no duplicates", () => {
    const relationships = [makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" })];
    expect(findDuplicateRelationships(relationships)).toEqual([]);
  });
});
