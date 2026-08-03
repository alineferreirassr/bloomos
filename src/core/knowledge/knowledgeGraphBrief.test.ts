import { describe, expect, it } from "vitest";
import {
  generateRelationshipSummary,
  generateAssetUsageSummary,
  generateEntityConnectionSummary,
  generateDependencySummary,
  generateOrphanedAssetSummary,
  generateSemanticContext,
  generateImpactContext,
  generateTimelineContext,
} from "@/core/knowledge/knowledgeGraphBrief";
import type { KnowledgeRelationship, KnowledgeNodeRef, OrphanedAssetFinding } from "@/types/knowledgeGraph";
import type { TimelineActivity } from "@/types/timelineActivity";

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

describe("generateRelationshipSummary", () => {
  it("reports no relationships for an isolated node", () => {
    expect(generateRelationshipSummary(asset, [])).toContain("no recorded relationships");
  });

  it("reports counts for a connected node", () => {
    const rel = makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" });
    expect(generateRelationshipSummary(asset, [rel])).toContain("1 relationship");
  });
});

describe("generateAssetUsageSummary", () => {
  it("reports zero usage", () => {
    expect(generateAssetUsageSummary(asset, [])).toContain("not currently referenced");
  });

  it("reports usage broken down by node type", () => {
    const rel = makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" });
    const summary = generateAssetUsageSummary(asset, [rel]);
    expect(summary).toContain("1 record");
    expect(summary).toContain("event");
  });
});

describe("generateEntityConnectionSummary", () => {
  it("reports no connections", () => {
    expect(generateEntityConnectionSummary(asset, [])).toContain("No connections recorded");
  });

  it("breaks connections down by relationship type label", () => {
    const rel = makeRel({ source_node_type: asset.nodeType, source_node_id: asset.nodeId, target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" });
    expect(generateEntityConnectionSummary(asset, [rel])).toContain("Belongs To");
  });
});

describe("generateDependencySummary", () => {
  it("reports safe-to-delete when nothing depends on the node", () => {
    expect(generateDependencySummary(asset, [])).toContain("safe to remove");
  });

  it("warns about active Event dependents", () => {
    const rel = makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" });
    const summary = generateDependencySummary(asset, [rel]);
    expect(summary).toContain("1 record");
    expect(summary).toContain("active Event");
  });
});

describe("generateOrphanedAssetSummary", () => {
  it("reports no orphans", () => {
    expect(generateOrphanedAssetSummary([])).toBe("No orphaned assets detected.");
  });

  it("summarizes findings by reason", () => {
    const findings: OrphanedAssetFinding[] = [
      { node: asset, reason: "no_relationships", detail: "x" },
      { node: asset, reason: "no_relationships", detail: "y" },
      { node: asset, reason: "archived_but_referenced", detail: "z" },
    ];
    const summary = generateOrphanedAssetSummary(findings);
    expect(summary).toContain("3 orphan finding");
    expect(summary).toContain("2 no relationships");
    expect(summary).toContain("1 archived but referenced");
  });
});

describe("generateSemanticContext", () => {
  it("reports no business meaning when no relationship has semantics", () => {
    const rel = makeRel({ source_node_type: asset.nodeType, source_node_id: asset.nodeId, target_node_type: "event", target_node_id: "event_1", relationship_type: "belongs_to" });
    expect(generateSemanticContext(asset, [rel])).toContain("No business meaning");
  });

  it("describes a semantically-tagged relationship by role", () => {
    const rel = makeRel({
      source_node_type: asset.nodeType,
      source_node_id: asset.nodeId,
      target_node_type: "event",
      target_node_id: "event_1",
      relationship_type: "used_by",
      semantics: { role: "hero_image", businessMeaning: null, category: "marketing", importance: "high", priority: "normal", lifecycle: "active", visibility: "client", ownerMemberId: null, businessContext: null },
    });
    const context = generateSemanticContext(asset, [rel]);
    expect(context).toContain("Hero Image");
    expect(context).toContain("marketing");
  });
});

describe("generateImpactContext", () => {
  it("reports safe when nothing depends on the node", () => {
    expect(generateImpactContext(asset, [])).toContain("safe to change");
  });

  it("names affected categories with non-zero counts", () => {
    const rel = makeRel({ source_node_type: "event", source_node_id: "event_1", target_node_type: asset.nodeType, target_node_id: asset.nodeId, relationship_type: "used_by" });
    const context = generateImpactContext(asset, [rel]);
    expect(context).toContain("1 Events");
  });
});

describe("generateTimelineContext", () => {
  function makeActivity(overrides: Partial<TimelineActivity> & Pick<TimelineActivity, "id" | "timestamp" | "description">): TimelineActivity {
    return {
      workspace_id: "ws_1",
      owner_type: "media_asset",
      owner_id: "asset_1",
      type: "media_asset_uploaded",
      actor: "Ana",
      ...overrides,
    };
  }

  it("reports no recent activity for an empty list", () => {
    expect(generateTimelineContext([])).toContain("No recent Timeline activity");
  });

  it("lists the most recent activities, newest first", () => {
    const activities = [
      makeActivity({ id: "a1", timestamp: "2026-01-01T00:00:00.000Z", description: "First" }),
      makeActivity({ id: "a2", timestamp: "2026-01-02T00:00:00.000Z", description: "Second" }),
    ];
    const context = generateTimelineContext(activities);
    expect(context.indexOf("Second")).toBeLessThan(context.indexOf("First"));
  });
});
