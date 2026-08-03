import { describe, it, expect } from "vitest";
import { buildContractDocumentRelationships, buildContractProposalRelationship, buildContractDocumentLinkRelationship } from "@/core/contractPlatform/contractKnowledgeGraphEngine";
import { makeSnapshot } from "@/core/contractPlatform/testFixtures";

describe("buildContractDocumentRelationships", () => {
  it("always includes the client edge, even with no snapshot", () => {
    const specs = buildContractDocumentRelationships("contract_1", "client_1", null);
    expect(specs).toEqual([{ sourceNode: { nodeType: "contract", nodeId: "contract_1" }, targetNode: { nodeType: "client", nodeId: "client_1" }, relationshipType: "contract_related_client" }]);
  });

  it("adds a template edge when the snapshot names a builder template", () => {
    const snapshot = makeSnapshot({ builderTemplateId: "template_1" });
    const specs = buildContractDocumentRelationships("contract_1", "client_1", snapshot);
    expect(specs).toContainEqual({ sourceNode: { nodeType: "contract", nodeId: "contract_1" }, targetNode: { nodeType: "contract_builder_template", nodeId: "template_1" }, relationshipType: "contract_uses_template" });
  });

  it("adds one clause edge per clauseId in the snapshot", () => {
    const snapshot = makeSnapshot({ clauseIds: ["clause_a", "clause_b"] });
    const specs = buildContractDocumentRelationships("contract_1", "client_1", snapshot);
    const clauseEdges = specs.filter((s) => s.relationshipType === "contract_contains_clause");
    expect(clauseEdges).toHaveLength(2);
    expect(clauseEdges.map((e) => e.targetNode.nodeId)).toEqual(["clause_a", "clause_b"]);
  });

  it("omits the template edge when the snapshot has no builder template", () => {
    const snapshot = makeSnapshot({ builderTemplateId: null });
    const specs = buildContractDocumentRelationships("contract_1", "client_1", snapshot);
    expect(specs.some((s) => s.relationshipType === "contract_uses_template")).toBe(false);
  });
});

describe("buildContractProposalRelationship", () => {
  it("returns no edges when no proposal is linked", () => {
    expect(buildContractProposalRelationship("contract_1", null)).toEqual([]);
  });

  it("returns one edge pointing at the resolved proposal", () => {
    const specs = buildContractProposalRelationship("contract_1", "proposal_1");
    expect(specs).toEqual([{ sourceNode: { nodeType: "contract", nodeId: "contract_1" }, targetNode: { nodeType: "proposal", nodeId: "proposal_1" }, relationshipType: "contract_related_proposal" }]);
  });
});

describe("buildContractDocumentLinkRelationship", () => {
  it("returns a single edge to the linked document", () => {
    const spec = buildContractDocumentLinkRelationship("contract_1", "document_1");
    expect(spec).toEqual({ sourceNode: { nodeType: "contract", nodeId: "contract_1" }, targetNode: { nodeType: "document", nodeId: "document_1" }, relationshipType: "contract_related_document" });
  });
});
