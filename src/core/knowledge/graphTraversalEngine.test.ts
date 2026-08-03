import { describe, expect, it } from "vitest";
import { getOutboundRelationships, getInboundRelationships, getRelationshipCounts, oneHop, multiHop, shortestPath } from "@/core/knowledge/graphTraversalEngine";
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

const node = (nodeId: string): KnowledgeNodeRef => ({ nodeType: "media_asset", nodeId });

describe("getOutboundRelationships / getInboundRelationships", () => {
  const a = node("a");
  const b = node("b");
  const rel = makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" });

  it("finds outbound edges from the source side", () => {
    expect(getOutboundRelationships(a, [rel])).toEqual([rel]);
    expect(getOutboundRelationships(b, [rel])).toEqual([]);
  });

  it("finds inbound edges from the target side", () => {
    expect(getInboundRelationships(b, [rel])).toEqual([rel]);
    expect(getInboundRelationships(a, [rel])).toEqual([]);
  });
});

describe("getRelationshipCounts", () => {
  it("counts inbound, outbound, and total", () => {
    const a = node("a");
    const b = node("b");
    const c = node("c");
    const relationships = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" }),
      makeRel({ source_node_type: c.nodeType, source_node_id: c.nodeId, target_node_type: a.nodeType, target_node_id: a.nodeId, relationship_type: "related_to" }),
    ];
    const counts = getRelationshipCounts(a, relationships);
    expect(counts).toEqual({ inbound: 1, outbound: 1, total: 2 });
  });
});

describe("oneHop / multiHop", () => {
  const a = node("a");
  const b = node("b");
  const c = node("c");
  const d = node("d");
  const relationships = [
    makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" }),
    makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: c.nodeType, target_node_id: c.nodeId, relationship_type: "belongs_to" }),
    makeRel({ source_node_type: c.nodeType, source_node_id: c.nodeId, target_node_type: d.nodeType, target_node_id: d.nodeId, relationship_type: "belongs_to" }),
  ];

  it("oneHop returns only direct neighbors", () => {
    const hop = oneHop(a, relationships, "outbound");
    expect(hop.map((h) => h.node.nodeId)).toEqual(["b"]);
  });

  it("multiHop reaches deeper nodes within maxDepth", () => {
    const hops = multiHop(a, relationships, 5, "outbound");
    expect(hops.map((h) => h.node.nodeId).sort()).toEqual(["b", "c", "d"]);
  });

  it("multiHop respects a shallower maxDepth", () => {
    const hops = multiHop(a, relationships, 1, "outbound");
    expect(hops.map((h) => h.node.nodeId)).toEqual(["b"]);
  });

  it("multiHop never revisits a node even with a circular mesh (related_to, both directions)", () => {
    const circular = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "related_to" }),
      makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: a.nodeType, target_node_id: a.nodeId, relationship_type: "related_to" }),
    ];
    const hops = multiHop(a, circular, 10, "both");
    expect(hops.map((h) => h.node.nodeId)).toEqual(["b"]);
  });
});

describe("shortestPath", () => {
  const a = node("a");
  const b = node("b");
  const c = node("c");
  const d = node("d");

  it("finds the shortest path across multiple hops", () => {
    const relationships = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" }),
      makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: c.nodeType, target_node_id: c.nodeId, relationship_type: "belongs_to" }),
    ];
    const path = shortestPath(a, c, relationships);
    expect(path?.nodes.map((n) => n.nodeId)).toEqual(["a", "b", "c"]);
  });

  it("returns null when no path exists", () => {
    const relationships = [makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" })];
    expect(shortestPath(a, d, relationships)).toBeNull();
  });

  it("prefers the shorter of two available paths", () => {
    const relationships = [
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: d.nodeType, target_node_id: d.nodeId, relationship_type: "related_to" }),
      makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "related_to" }),
      makeRel({ source_node_type: b.nodeType, source_node_id: b.nodeId, target_node_type: c.nodeType, target_node_id: c.nodeId, relationship_type: "related_to" }),
      makeRel({ source_node_type: c.nodeType, source_node_id: c.nodeId, target_node_type: d.nodeType, target_node_id: d.nodeId, relationship_type: "related_to" }),
    ];
    const path = shortestPath(a, d, relationships);
    expect(path?.nodes.map((n) => n.nodeId)).toEqual(["a", "d"]);
  });
});

describe("adjacency index memoization (Step 15 performance)", () => {
  it("returns consistent results across repeated calls with the same relationship array reference", () => {
    const a = node("a");
    const b = node("b");
    const relationships = [makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" })];

    const first = getOutboundRelationships(a, relationships);
    const second = getOutboundRelationships(a, relationships);
    expect(second).toEqual(first);
    expect(getInboundRelationships(b, relationships)).toHaveLength(1);
  });

  it("reflects a fresh relationship array (new reference) without stale results from a previous array", () => {
    const a = node("a");
    const b = node("b");
    const first = [makeRel({ source_node_type: a.nodeType, source_node_id: a.nodeId, target_node_type: b.nodeType, target_node_id: b.nodeId, relationship_type: "belongs_to" })];
    expect(getOutboundRelationships(a, first)).toHaveLength(1);

    const second: typeof first = [];
    expect(getOutboundRelationships(a, second)).toHaveLength(0);
  });
});
