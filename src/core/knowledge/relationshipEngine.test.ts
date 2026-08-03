import { describe, expect, it } from "vitest";
import { wouldCreateRelationshipCycle, isValidRelationshipCandidate } from "@/core/knowledge/relationshipEngine";
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

const a: KnowledgeNodeRef = { nodeType: "media_asset", nodeId: "a" };
const b: KnowledgeNodeRef = { nodeType: "media_asset", nodeId: "b" };
const c: KnowledgeNodeRef = { nodeType: "media_asset", nodeId: "c" };

describe("wouldCreateRelationshipCycle", () => {
  it("is false for a non-hierarchical relationship type regardless of structure", () => {
    const existing = [makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: a.nodeType, target_node_id: a.nodeId, relationship_type: "related_to" })];
    expect(wouldCreateRelationshipCycle(a, b, "related_to", existing)).toBe(false);
  });

  it("rejects a direct self-cycle for a hierarchical type", () => {
    expect(wouldCreateRelationshipCycle(a, a, "belongs_to", [])).toBe(true);
  });

  it("detects a transitive cycle (a -> b -> c, adding c -> a)", () => {
    const existing = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" }),
      makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: c.nodeType, target_node_id: c.nodeId, relationship_type: "belongs_to" }),
    ];
    expect(wouldCreateRelationshipCycle(c, a, "belongs_to", existing)).toBe(true);
  });

  it("allows a non-cyclical hierarchical addition", () => {
    const existing = [makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" })];
    expect(wouldCreateRelationshipCycle(c, a, "belongs_to", existing)).toBe(false);
  });

  it("ignores archived edges when walking for a cycle", () => {
    const existing = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to", status: "archived" }),
    ];
    expect(wouldCreateRelationshipCycle(b, a, "belongs_to", existing)).toBe(false);
  });
});

describe("isValidRelationshipCandidate", () => {
  it("rejects a self-relationship", () => {
    expect(isValidRelationshipCandidate(a, a)).toBe(false);
  });

  it("rejects an empty node id", () => {
    expect(isValidRelationshipCandidate({ nodeType: "media_asset", nodeId: "  " }, b)).toBe(false);
  });

  it("accepts two distinct, well-formed nodes", () => {
    expect(isValidRelationshipCandidate(a, b)).toBe(true);
  });
});
