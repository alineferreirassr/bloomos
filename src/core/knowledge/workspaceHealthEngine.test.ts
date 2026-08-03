import { describe, expect, it } from "vitest";
import { computeWorkspaceHealth } from "@/core/knowledge/workspaceHealthEngine";
import { makeDocument } from "@/modules/documents/testUtils";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { MediaAsset } from "@/types/mediaAsset";
import type { ProposalDraft } from "@/types/proposal";
import type { CompletenessResult } from "@/types/businessHealth";

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

const NOW = "2026-07-30T00:00:00.000Z";

const baseInput = {
  nodesToValidate: [] as KnowledgeNodeRef[],
  relationships: [] as KnowledgeRelationship[],
  assets: [] as MediaAsset[],
  existingNodeKeys: new Set<string>(),
  documents: [] as ReturnType<typeof makeDocument>[],
  proposalCompleteness: [] as CompletenessResult[],
  eventCompleteness: [] as CompletenessResult[],
  proposals: [] as Pick<ProposalDraft, "status" | "reviewed_at" | "generated_at">[],
  now: NOW,
};

describe("computeWorkspaceHealth", () => {
  it("returns all zeros for a perfectly clean, empty workspace", () => {
    const report = computeWorkspaceHealth(baseInput);
    expect(report).toEqual({
      assetsWithoutOwners: 0,
      brokenRelationships: 0,
      missingRequiredRelationships: 0,
      invalidConstraints: 0,
      expiredDocuments: 0,
      archivedAssetsStillReferenced: 0,
      duplicateRelationshipGroups: 0,
      unusedTemplates: 0,
      incompleteProposals: 0,
      incompleteEvents: 0,
      overdueApprovals: 0,
      pendingDependencies: 0,
    });
  });

  it("counts an asset whose owner no longer exists as assetsWithoutOwners", () => {
    const asset = makeAsset({ id: "asset_1", owner_type: "event", owner_id: "ghost_event" });
    const report = computeWorkspaceHealth({ ...baseInput, assets: [asset], existingNodeKeys: new Set() });
    expect(report.assetsWithoutOwners).toBe(1);
  });

  it("counts an archived asset that still has an inbound reference", () => {
    const asset = makeAsset({ id: "asset_1", archived_at: "2026-01-01T00:00:00.000Z" });
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "media_asset", target_node_id: "asset_1", relationship_type: "used_by" })];
    const report = computeWorkspaceHealth({ ...baseInput, assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1", "media_asset:asset_1"]) });
    expect(report.archivedAssetsStillReferenced).toBe(1);
  });

  it("counts a broken relationship and a duplicate relationship group", () => {
    const relationships = [
      makeRel({ source_node_type: "media_asset", source_node_id: "a1", target_node_type: "event", target_node_id: "ghost", relationship_type: "used_by" }),
      makeRel({ source_node_type: "media_asset", source_node_id: "a2", target_node_type: "event", target_node_id: "event_1", relationship_type: "used_by" }),
      makeRel({ source_node_type: "media_asset", source_node_id: "a2", target_node_type: "event", target_node_id: "event_1", relationship_type: "used_by" }),
    ];
    const report = computeWorkspaceHealth({ ...baseInput, relationships, existingNodeKeys: new Set(["media_asset:a2", "event:event_1"]) });
    expect(report.brokenRelationships).toBe(1);
    expect(report.duplicateRelationshipGroups).toBe(1);
  });

  it("counts constraint violations, splitting out the minCount subset as missingRequiredRelationships", () => {
    const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const report = computeWorkspaceHealth({ ...baseInput, nodesToValidate: [node] });
    expect(report.invalidConstraints).toBe(1);
    expect(report.missingRequiredRelationships).toBe(1);
  });

  it("counts a document past its expires_at as expiredDocuments", () => {
    const expired = makeDocument({ id: "doc_1", expires_at: "2026-01-01T00:00:00.000Z" });
    const notExpired = makeDocument({ id: "doc_2", expires_at: "2027-01-01T00:00:00.000Z" });
    const noExpiry = makeDocument({ id: "doc_3", expires_at: null });
    const report = computeWorkspaceHealth({ ...baseInput, documents: [expired, notExpired, noExpiry] });
    expect(report.expiredDocuments).toBe(1);
  });

  it("counts proposals/events with missing requirements as incomplete", () => {
    const report = computeWorkspaceHealth({
      ...baseInput,
      proposalCompleteness: [{ missingRequirements: ["Missing Pricing"], score: 80 }, { missingRequirements: [], score: 100 }],
      eventCompleteness: [{ missingRequirements: ["Missing Vendor"], score: 83 }],
    });
    expect(report.incompleteProposals).toBe(1);
    expect(report.incompleteEvents).toBe(1);
  });

  it("counts a still-unreviewed draft proposal past the overdue threshold", () => {
    const overdue: Pick<ProposalDraft, "status" | "reviewed_at" | "generated_at"> = { status: "draft", reviewed_at: null, generated_at: "2026-07-01T00:00:00.000Z" };
    const recent: Pick<ProposalDraft, "status" | "reviewed_at" | "generated_at"> = { status: "draft", reviewed_at: null, generated_at: "2026-07-29T00:00:00.000Z" };
    const reviewed: Pick<ProposalDraft, "status" | "reviewed_at" | "generated_at"> = { status: "draft", reviewed_at: "2026-07-02T00:00:00.000Z", generated_at: "2026-07-01T00:00:00.000Z" };
    const report = computeWorkspaceHealth({ ...baseInput, proposals: [overdue, recent, reviewed] });
    expect(report.overdueApprovals).toBe(1);
  });

  it("counts a pending-approval asset that already has a relationship depending on it", () => {
    const asset = makeAsset({ id: "asset_1", status: "pending" });
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: "media_asset", target_node_id: "asset_1", relationship_type: "used_by" })];
    const report = computeWorkspaceHealth({ ...baseInput, assets: [asset], relationships, existingNodeKeys: new Set(["event:event_1", "media_asset:asset_1"]) });
    expect(report.pendingDependencies).toBe(1);
  });

  it("does not count a pending asset with no relationships yet as a pending dependency", () => {
    const asset = makeAsset({ id: "asset_1", status: "pending" });
    const report = computeWorkspaceHealth({ ...baseInput, assets: [asset], existingNodeKeys: new Set() });
    expect(report.pendingDependencies).toBe(0);
  });
});
