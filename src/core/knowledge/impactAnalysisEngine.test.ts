import { describe, expect, it } from "vitest";
import { computeImpactAnalysis, computeDetailedImpact } from "@/core/knowledge/impactAnalysisEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";

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

const asset: KnowledgeNodeRef = { nodeType: "media_asset", nodeId: "asset_1" };

describe("computeImpactAnalysis", () => {
  it("is safe to delete when nothing depends on it", () => {
    const result = computeImpactAnalysis(asset, []);
    expect(result.isSafeToDelete).toBe(true);
    expect(result.totalDependents).toBe(0);
  });

  it("groups dependents by node type", () => {
    const relationships = [
      makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" }),
      makeRel({ source_node_type: "event", source_node_id: "event_2", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" }),
      makeRel({ source_node_type: "proposal", source_node_id: "proposal_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" }),
    ];
    const result = computeImpactAnalysis(asset, relationships);
    expect(result.totalDependents).toBe(3);
    expect(result.byNodeType.event).toHaveLength(2);
    expect(result.byNodeType.proposal).toHaveLength(1);
    expect(result.isSafeToDelete).toBe(false);
  });

  it("flags an active Event dependent", () => {
    const relationships = [makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" })];
    expect(computeImpactAnalysis(asset, relationships).hasActiveEventDependents).toBe(true);
  });

  it("flags an approval dependent", () => {
    const relationships = [makeRel({ source_node_type: "team_member", source_node_id: "member_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "approved_by" })];
    expect(computeImpactAnalysis(asset, relationships).hasApprovalDependents).toBe(true);
  });

  it("flags an automation/workflow dependent", () => {
    const relationships = [makeRel({ source_node_type: "automation", source_node_id: "automation_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "produced_by_automation" })];
    expect(computeImpactAnalysis(asset, relationships).hasAutomationOrWorkflowDependents).toBe(true);
  });

  it("ignores outbound relationships — only inbound counts as a dependent", () => {
    const relationships = [makeRel({ source_node_type: asset.nodeType, source_node_id: asset.nodeId, target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" })];
    const result = computeImpactAnalysis(asset, relationships);
    expect(result.totalDependents).toBe(0);
    expect(result.isSafeToDelete).toBe(true);
  });
});

describe("computeDetailedImpact", () => {
  it("buckets dependents into the named Step 10.8 categories", () => {
    const relationships = [
      makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" }),
      makeRel({ source_node_type: "client", source_node_id: "client_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" }),
      makeRel({ source_node_type: "document", source_node_id: "document_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "referenced_by" }),
      makeRel({ source_node_type: "workflow", source_node_id: "workflow_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "produced_by_workflow" }),
      makeRel({ source_node_type: "automation", source_node_id: "automation_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "produced_by_automation" }),
      makeRel({ source_node_type: "media_collection", source_node_id: "collection_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "included_in" }),
      makeRel({ source_node_type: "ai_insight", source_node_id: "insight_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "related_to" }),
      makeRel({ source_node_type: "checklist_item", source_node_id: "checklist_item_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "appears_in_timeline" }),
    ];
    const detailed = computeDetailedImpact(asset, relationships);
    expect(detailed.affectedEvents).toHaveLength(1);
    expect(detailed.affectedClients).toHaveLength(1);
    expect(detailed.affectedDocuments).toHaveLength(1);
    expect(detailed.affectedWorkflows).toHaveLength(1);
    expect(detailed.affectedAutomations).toHaveLength(1);
    expect(detailed.affectedCollections).toHaveLength(1);
    expect(detailed.affectedAiContext).toHaveLength(1);
    expect(detailed.affectedTimelineEntries).toHaveLength(1);
  });

  it("returns empty arrays for every category when there are no dependents", () => {
    const detailed = computeDetailedImpact(asset, []);
    expect(detailed.affectedAssets).toEqual([]);
    expect(detailed.affectedTimelineEntries).toEqual([]);
    expect(detailed.base.isSafeToDelete).toBe(true);
  });
});
