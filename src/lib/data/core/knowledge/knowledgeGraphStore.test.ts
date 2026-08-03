import { afterEach, describe, expect, it } from "vitest";
import { mockKnowledgeGraphRepository, resetKnowledgeGraphStore, nodeRefEquals } from "@/lib/data/core/knowledge/knowledgeGraphStore";

const WORKSPACE = "ws_1";

afterEach(() => {
  resetKnowledgeGraphStore();
});

describe("createRelationship", () => {
  it("creates an active relationship by default", async () => {
    const result = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "event",
      targetNodeId: "event_1",
      relationshipType: "belongs_to",
      source: "asset_upload",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.confidence).toBe(100);
      expect(result.data.semantics).toBeNull();
    }
  });

  it("rejects a self-relationship", async () => {
    const result = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "media_asset",
      targetNodeId: "asset_1",
      relationshipType: "related_to",
      source: "user_action",
    });
    expect(result.success).toBe(false);
  });

  it("returns the existing edge instead of duplicating an exact match", async () => {
    const input = {
      sourceNodeType: "media_asset" as const,
      sourceNodeId: "asset_1",
      targetNodeType: "event" as const,
      targetNodeId: "event_1",
      relationshipType: "belongs_to" as const,
      source: "asset_upload" as const,
    };
    const first = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", input);
    const second = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", input);
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(second.data.id).toBe(first.data.id);
    }
    const all = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(WORKSPACE);
    expect(all).toHaveLength(1);
  });

  it("forces a future_ai_suggestion relationship to start rejected, never active", async () => {
    const result = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "event",
      targetNodeId: "event_1",
      relationshipType: "related_to",
      source: "future_ai_suggestion",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("rejected");
  });

  it("accepts explicit semantics on creation", async () => {
    const result = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "event",
      targetNodeId: "event_1",
      relationshipType: "belongs_to",
      source: "asset_upload",
      semantics: { role: "hero_image", businessMeaning: null, category: "marketing", importance: "high", priority: "normal", lifecycle: "active", visibility: "client", ownerMemberId: null, businessContext: null },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.semantics?.role).toBe("hero_image");
  });
});

describe("removeRelationship / approveRelationship / rejectRelationship", () => {
  async function seed() {
    const created = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "event",
      targetNodeId: "event_1",
      relationshipType: "belongs_to",
      source: "asset_upload",
    });
    if (!created.success) throw new Error("setup failed");
    return created.data;
  }

  it("soft-archives on removal", async () => {
    const rel = await seed();
    const removed = await mockKnowledgeGraphRepository.removeRelationship(rel.id, WORKSPACE);
    expect(removed.success).toBe(true);
    if (removed.success) expect(removed.data.status).toBe("archived");

    const activeOnly = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(WORKSPACE);
    expect(activeOnly).toHaveLength(0);
    const includingInactive = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(WORKSPACE, true);
    expect(includingInactive).toHaveLength(1);
  });

  it("rejects then approves a relationship", async () => {
    const rel = await seed();
    const rejected = await mockKnowledgeGraphRepository.rejectRelationship(rel.id, WORKSPACE);
    expect(rejected.success && rejected.data.status === "rejected").toBe(true);

    const approved = await mockKnowledgeGraphRepository.approveRelationship(rel.id, WORKSPACE);
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.status).toBe("active");
      expect(approved.data.confidence).toBe(100);
    }
  });

  it("returns a failure for a relationship that does not exist", async () => {
    const result = await mockKnowledgeGraphRepository.removeRelationship("nope", WORKSPACE);
    expect(result.success).toBe(false);
  });
});

describe("setRelationshipSemantics", () => {
  it("assigns semantics to an existing relationship", async () => {
    const created = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "contract",
      targetNodeId: "contract_1",
      relationshipType: "attached_to",
      source: "user_action",
    });
    if (!created.success) throw new Error("setup failed");

    const updated = await mockKnowledgeGraphRepository.setRelationshipSemantics(created.data.id, WORKSPACE, {
      role: "primary_contract",
      businessMeaning: "The signed master services agreement",
      category: "legal",
      importance: "critical",
      priority: "normal",
      lifecycle: "active",
      visibility: "internal",
      ownerMemberId: "member_1",
      businessContext: null,
    });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.semantics?.role).toBe("primary_contract");
      expect(updated.data.semantics?.category).toBe("legal");
    }
  });

  it("clears semantics back to null", async () => {
    const created = await mockKnowledgeGraphRepository.createRelationship(WORKSPACE, "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "contract",
      targetNodeId: "contract_1",
      relationshipType: "attached_to",
      source: "user_action",
      semantics: { role: "legal_attachment", businessMeaning: null, category: "legal", importance: "high", priority: "normal", lifecycle: "active", visibility: "internal", ownerMemberId: null, businessContext: null },
    });
    if (!created.success) throw new Error("setup failed");

    const cleared = await mockKnowledgeGraphRepository.setRelationshipSemantics(created.data.id, WORKSPACE, null);
    expect(cleared.success).toBe(true);
    if (cleared.success) expect(cleared.data.semantics).toBeNull();
  });
});

describe("workspace isolation", () => {
  it("never returns a relationship from a different workspace", async () => {
    await mockKnowledgeGraphRepository.createRelationship("ws_a", "member_1", {
      sourceNodeType: "media_asset",
      sourceNodeId: "asset_1",
      targetNodeType: "event",
      targetNodeId: "event_1",
      relationshipType: "belongs_to",
      source: "asset_upload",
    });
    const wsB = await mockKnowledgeGraphRepository.listRelationshipsForWorkspace("ws_b");
    expect(wsB).toHaveLength(0);
  });
});

describe("nodeRefEquals", () => {
  it("compares node type and id", () => {
    expect(nodeRefEquals({ nodeType: "event", nodeId: "1" }, { nodeType: "event", nodeId: "1" })).toBe(true);
    expect(nodeRefEquals({ nodeType: "event", nodeId: "1" }, { nodeType: "event", nodeId: "2" })).toBe(false);
    expect(nodeRefEquals({ nodeType: "event", nodeId: "1" }, { nodeType: "client", nodeId: "1" })).toBe(false);
  });
});
