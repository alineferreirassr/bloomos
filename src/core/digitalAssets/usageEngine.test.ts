import { describe, expect, it } from "vitest";
import { resolveAssetUsage } from "@/core/digitalAssets/usageEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";
import type { KnowledgeRelationship } from "@/types/knowledgeGraph";

function relationship(overrides: Partial<KnowledgeRelationship> = {}): KnowledgeRelationship {
  return {
    id: "rel_1",
    workspace_id: "ws_1",
    source_node_type: "media_asset",
    source_node_id: "asset_1",
    target_node_type: "contract",
    target_node_id: "contract_1",
    relationship_type: "attached_to",
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

describe("resolveAssetUsage", () => {
  it("marks an asset unused when it has no owner mapping, no documents, and no relationships", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [], []);
    expect(usage.isUnused).toBe(true);
    expect(usage.references).toHaveLength(0);
  });

  it("counts a client owner as a real usage reference", () => {
    const asset = buildTestAsset({ owner_type: "client", owner_id: "client_1" });
    const usage = resolveAssetUsage(asset, [], []);
    expect(usage.isUnused).toBe(false);
    expect(usage.references[0].context).toBe("client");
  });

  it("counts a Document back-reference via media_asset_id", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [], [{ id: "doc_1", title: "Contract PDF" }]);
    expect(usage.isUnused).toBe(false);
    expect(usage.references.find((r) => r.context === "document")).toBeTruthy();
  });

  it("counts an active Knowledge Graph relationship as generic usage", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [relationship()], []);
    expect(usage.isUnused).toBe(false);
    expect(usage.references.some((r) => r.context === "knowledge_graph")).toBe(true);
  });

  it("ignores archived (non-active) relationships", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [relationship({ status: "archived" })], []);
    expect(usage.isUnused).toBe(true);
  });

  it("ignores the automatic belongs_to provenance edge every upload emits", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [relationship({ relationship_type: "belongs_to", target_node_type: "workspace", target_node_id: "ws_1" })], []);
    expect(usage.isUnused).toBe(true);
    expect(usage.references).toHaveLength(0);
  });

  it("adds an execution_package reference for produces_deliverable edges", () => {
    const asset = buildTestAsset({ owner_type: "workspace" });
    const usage = resolveAssetUsage(asset, [relationship({ relationship_type: "produces_deliverable" })], []);
    expect(usage.references.some((r) => r.context === "execution_package")).toBe(true);
  });
});
