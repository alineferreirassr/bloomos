import { describe, it, expect } from "vitest";
import { buildProposalDocumentRelationships, buildProposalVersionChainRelationships, buildProposalDocumentRelationship } from "@/core/proposalPlatform/proposalKnowledgeGraphEngine";
import { makeSnapshot } from "@/core/proposalPlatform/testFixtures";

describe("buildProposalDocumentRelationships", () => {
  it("always includes a proposal_related_client edge", () => {
    const specs = buildProposalDocumentRelationships("proposal_1", "client_1", null);
    expect(specs).toHaveLength(1);
    expect(specs[0].relationshipType).toBe("proposal_related_client");
  });

  it("includes a proposal_uses_template edge when the snapshot has a template", () => {
    const snapshot = makeSnapshot({ template_id: "tmpl_1" });
    const specs = buildProposalDocumentRelationships("proposal_1", "client_1", snapshot);
    expect(specs.some((s) => s.relationshipType === "proposal_uses_template" && s.targetNode.nodeId === "tmpl_1")).toBe(true);
  });

  it("includes one proposal_contains_package edge per selected package", () => {
    const snapshot = makeSnapshot({ packageIds: ["pkg_1", "pkg_2"] });
    const specs = buildProposalDocumentRelationships("proposal_1", "client_1", snapshot);
    expect(specs.filter((s) => s.relationshipType === "proposal_contains_package")).toHaveLength(2);
  });

  it("includes one proposal_contains_addon edge per selected add-on", () => {
    const snapshot = makeSnapshot({ addonIds: ["addon_1"] });
    const specs = buildProposalDocumentRelationships("proposal_1", "client_1", snapshot);
    expect(specs.filter((s) => s.relationshipType === "proposal_contains_addon")).toHaveLength(1);
  });

  it("omits template/package/addon edges when there is no template id", () => {
    const snapshot = makeSnapshot({ template_id: null, packageIds: [], addonIds: [] });
    const specs = buildProposalDocumentRelationships("proposal_1", "client_1", snapshot);
    expect(specs).toHaveLength(1);
  });
});

describe("buildProposalVersionChainRelationships", () => {
  it("returns no edges when there is no parent proposal", () => {
    expect(buildProposalVersionChainRelationships("proposal_2", null)).toHaveLength(0);
  });

  it("emits both version_of and supersedes edges when a parent exists", () => {
    const specs = buildProposalVersionChainRelationships("proposal_2", "proposal_1");
    expect(specs).toHaveLength(2);
    expect(specs.map((s) => s.relationshipType).sort()).toEqual(["proposal_supersedes", "proposal_version_of"]);
    expect(specs.every((s) => s.targetNode.nodeId === "proposal_1")).toBe(true);
  });
});

describe("buildProposalDocumentRelationship", () => {
  it("builds a single proposal_related_document edge", () => {
    const spec = buildProposalDocumentRelationship("proposal_1", "doc_1");
    expect(spec.relationshipType).toBe("proposal_related_document");
    expect(spec.targetNode).toEqual({ nodeType: "document", nodeId: "doc_1" });
  });
});
