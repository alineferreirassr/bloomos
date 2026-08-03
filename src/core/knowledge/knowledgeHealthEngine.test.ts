import { describe, expect, it } from "vitest";
import { findBrokenRelationships, findCircularReferenceGroups, computeKnowledgeHealth } from "@/core/knowledge/knowledgeHealthEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { MediaAsset } from "@/types/mediaAsset";

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

describe("findBrokenRelationships", () => {
  it("flags a relationship whose target isn't a known node", () => {
    const rel = makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "deleted_event", relationship_type: "belongs_to" });
    const broken = findBrokenRelationships([rel], new Set(["media_asset:a1"]));
    expect(broken).toEqual([rel]);
  });

  it("does not flag a relationship whose endpoints both exist", () => {
    const rel = makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" });
    const broken = findBrokenRelationships([rel], new Set(["media_asset:a1", "event:event_1"]));
    expect(broken).toEqual([]);
  });

  it("ignores archived relationships", () => {
    const rel = makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "gone", relationship_type: "belongs_to", status: "archived" });
    expect(findBrokenRelationships([rel], new Set())).toEqual([]);
  });
});

describe("findCircularReferenceGroups", () => {
  it("finds nothing in an acyclic chain", () => {
    const relationships = [
      makeRel({ source_node_type: "media_folder", source_node_id: "f1", target_node_type: "media_folder", target_node_id: "f2", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "media_folder", source_node_id: "f2", target_node_type: "media_folder", target_node_id: "f3", relationship_type: "belongs_to" }),
    ];
    expect(findCircularReferenceGroups(relationships)).toEqual([]);
  });

  it("detects a live cycle in already-existing hierarchical edges", () => {
    const relationships = [
      makeRel({ source_node_type: "media_folder", source_node_id: "f1", target_node_type: "media_folder", target_node_id: "f2", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "media_folder", source_node_id: "f2", target_node_type: "media_folder", target_node_id: "f1", relationship_type: "belongs_to" }),
    ];
    const groups = findCircularReferenceGroups(relationships);
    expect(groups.length).toBeGreaterThan(0);
  });

  it("ignores non-hierarchical relationship types even if they mesh circularly", () => {
    const relationships = [
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "media_asset", target_node_id: "a2", relationship_type: "related_to" }),
      makeRel({ source_node_type: "media_asset", source_node_id: "a2", target_node_type: "media_asset", target_node_id: "a1", relationship_type: "related_to" }),
    ];
    expect(findCircularReferenceGroups(relationships)).toEqual([]);
  });
});

describe("computeKnowledgeHealth", () => {
  it("composes every sub-check into one report", () => {
    const asset = makeAsset({ id: "a1" });
    const brokenRel = makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "deleted_event", relationship_type: "referenced_by" });

    const report = computeKnowledgeHealth({
      assets: [asset],
      relationships: [brokenRel],
      existingNodeKeys: new Set(["media_asset:a1"]),
      nodesToValidate: [{ nodeType: "media_asset", nodeId: "a1" } as KnowledgeNodeRef],
    });

    expect(report.brokenRelationships).toHaveLength(1);
    expect(report.orphanedAssets.length).toBeGreaterThan(0);
    expect(report.notApplicable).toEqual(["unused_templates", "expired_assets"]);
  });
});
