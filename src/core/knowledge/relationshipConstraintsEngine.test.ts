import { describe, expect, it } from "vitest";
import { validateNodeConstraints, validateRelationshipMutation, constraintsForNodeType } from "@/core/knowledge/relationshipConstraintsEngine";
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

describe("constraintsForNodeType", () => {
  it("returns only rules declared for the given node type", () => {
    const rules = constraintsForNodeType("invoice");
    expect(rules.every((r) => r.nodeType === "invoice")).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });
});

describe("validateNodeConstraints", () => {
  it("flags an Invoice with no Proposal as a minCount violation", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const violations = validateNodeConstraints(invoice, []);
    expect(violations.some((v) => v.constraint.id === "invoice_belongs_to_exactly_one_proposal")).toBe(true);
  });

  it("passes an Invoice with exactly one Proposal", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const relationships = [makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_1", relationship_type: "belongs_to" })];
    const violations = validateNodeConstraints(invoice, relationships);
    expect(violations).toEqual([]);
  });

  it("flags an Invoice with two Proposals as a maxCount violation", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const relationships = [
      makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_1", relationship_type: "belongs_to" }),
      makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_2", relationship_type: "belongs_to" }),
    ];
    const violations = validateNodeConstraints(invoice, relationships);
    expect(violations.some((v) => v.actualCount === 2)).toBe(true);
  });

  it("only counts a Hero Image edge when the semantic role matches", () => {
    const event: KnowledgeNodeRef = { nodeType: "event", nodeId: "event_1" };
    const withoutRole = [makeRel({ source_node_type: "media_asset", source_node_id: "asset_1", target_node_type: "event", target_node_id: "event_1", relationship_type: "used_by" })];
    expect(validateNodeConstraints(event, withoutRole).some((v) => v.constraint.id === "event_requires_at_least_one_hero_image")).toBe(true);

    const withRole = [
      makeRel({
        source_node_type: "media_asset",
        source_node_id: "asset_1",
        target_node_type: "event",
        target_node_id: "event_1",
        relationship_type: "used_by",
        semantics: { role: "hero_image", businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null },
      }),
    ];
    expect(validateNodeConstraints(event, withRole).some((v) => v.constraint.id === "event_requires_at_least_one_hero_image")).toBe(false);
  });

  it("never flags a Client for having zero or many Contracts (no minCount/maxCount)", () => {
    const client: KnowledgeNodeRef = { nodeType: "client", nodeId: "client_1" };
    expect(validateNodeConstraints(client, [])).toEqual([]);
  });
});

describe("validateRelationshipMutation", () => {
  it("blocks a self-relationship", () => {
    const node: KnowledgeNodeRef = { nodeType: "media_asset", nodeId: "a1" };
    const check = validateRelationshipMutation(node, node, "related_to", []);
    expect(check.allowed).toBe(false);
  });

  it("blocks a mutation that would create a cycle", () => {
    const a: KnowledgeNodeRef = { nodeType: "media_folder", nodeId: "f1" };
    const b: KnowledgeNodeRef = { nodeType: "media_folder", nodeId: "f2" };
    const existing = [makeRel({ source_node_type: "media_folder", source_node_id: "f1", target_node_type: "media_folder", target_node_id: "f2", relationship_type: "belongs_to" })];
    const check = validateRelationshipMutation(b, a, "belongs_to", existing);
    expect(check.allowed).toBe(false);
  });

  it("hard-blocks adding a second Proposal to an Invoice that already has one", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const proposal2: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_2" };
    const existing = [makeRel({ source_node_type: "invoice", source_node_id: "invoice_1", target_node_type: "proposal", target_node_id: "proposal_1", relationship_type: "belongs_to" })];
    const check = validateRelationshipMutation(invoice, proposal2, "belongs_to", existing);
    expect(check.allowed).toBe(false);
    expect(check.hardViolations.length).toBeGreaterThan(0);
  });

  it("allows a well-formed, non-cyclical, constraint-respecting mutation", () => {
    const invoice: KnowledgeNodeRef = { nodeType: "invoice", nodeId: "invoice_1" };
    const proposal: KnowledgeNodeRef = { nodeType: "proposal", nodeId: "proposal_1" };
    const check = validateRelationshipMutation(invoice, proposal, "belongs_to", []);
    expect(check.allowed).toBe(true);
    expect(check.hardViolations).toEqual([]);
  });
});

describe("event_at_most_one_primary_contract (Step 15.5)", () => {
  it("flags a second Primary Contract on the same Event", () => {
    const event: KnowledgeNodeRef = { nodeType: "event", nodeId: "event_1" };
    const primarySemantics = { role: "primary_contract" as const, businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null };
    const relationships = [
      makeRel({ source_node_type: "contract", source_node_id: "contract_1", target_node_type: "event", target_node_id: "event_1", relationship_type: "associated_with_event", semantics: primarySemantics }),
      makeRel({ source_node_type: "contract", source_node_id: "contract_2", target_node_type: "event", target_node_id: "event_1", relationship_type: "associated_with_event", semantics: primarySemantics }),
    ];
    const violations = validateNodeConstraints(event, relationships);
    expect(violations.some((v) => v.constraint.id === "event_at_most_one_primary_contract")).toBe(true);
  });

  it("does not flag a single Primary Contract", () => {
    const event: KnowledgeNodeRef = { nodeType: "event", nodeId: "event_1" };
    const relationships = [
      makeRel({
        source_node_type: "contract",
        source_node_id: "contract_1",
        target_node_type: "event",
        target_node_id: "event_1",
        relationship_type: "associated_with_event",
        semantics: { role: "primary_contract", businessMeaning: null, category: null, importance: null, priority: null, lifecycle: null, visibility: null, ownerMemberId: null, businessContext: null },
      }),
    ];
    const violations = validateNodeConstraints(event, relationships);
    expect(violations.some((v) => v.constraint.id === "event_at_most_one_primary_contract")).toBe(false);
  });
});
