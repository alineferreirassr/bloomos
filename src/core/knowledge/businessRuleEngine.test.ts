import { describe, expect, it } from "vitest";
import { findInvalidParentFolders, computeBusinessRuleViolations } from "@/core/knowledge/businessRuleEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { MediaFolder } from "@/types/mediaFolder";

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

function makeFolder(overrides: Partial<MediaFolder> & Pick<MediaFolder, "id">): MediaFolder {
  return {
    workspace_id: "ws_1",
    owner_type: null,
    owner_id: null,
    parent_folder_id: null,
    name: overrides.id,
    sort_order: 0,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

describe("findInvalidParentFolders", () => {
  it("flags a folder whose parent no longer exists", () => {
    const folders = [makeFolder({ id: "f1", parent_folder_id: "ghost" })];
    expect(findInvalidParentFolders(folders)).toEqual(folders);
  });

  it("does not flag a folder with a valid parent or a root folder", () => {
    const parent = makeFolder({ id: "parent" });
    const child = makeFolder({ id: "child", parent_folder_id: "parent" });
    expect(findInvalidParentFolders([parent, child])).toEqual([]);
  });
});

describe("computeBusinessRuleViolations", () => {
  it("surfaces constraint violations for the given nodes", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violations = computeBusinessRuleViolations({ nodesToValidate: [invoice], relationships: [], folders: [] });
    expect(violations.some((v) => v.ruleId === "invoice_belongs_to_exactly_one_proposal")).toBe(true);
  });

  it("surfaces a circular_dependency violation", () => {
    const relationships = [
      makeRel({ source_node_type: "media_folder", source_node_id: "f1", target_node_type: "media_folder", target_node_id: "f2", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "media_folder", source_node_id: "f2", target_node_type: "media_folder", target_node_id: "f1", relationship_type: "belongs_to" }),
    ];
    const violations = computeBusinessRuleViolations({ nodesToValidate: [], relationships, folders: [] });
    expect(violations.some((v) => v.ruleId === "circular_dependency")).toBe(true);
  });

  it("surfaces an invalid_parent_folder violation", () => {
    const folders = [makeFolder({ id: "f1", parent_folder_id: "ghost" })];
    const violations = computeBusinessRuleViolations({ nodesToValidate: [], relationships: [], folders });
    expect(violations.some((v) => v.ruleId === "invalid_parent_folder")).toBe(true);
  });

  it("returns no violations for a clean, empty input", () => {
    expect(computeBusinessRuleViolations({ nodesToValidate: [], relationships: [], folders: [] })).toEqual([]);
  });
});
