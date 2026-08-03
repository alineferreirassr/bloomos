import { describe, it, expect } from "vitest";
import { buildInvoiceClientRelationship, buildInvoiceContractRelationship, buildInvoiceProposalRelationship, buildInvoiceDocumentLinkRelationship } from "@/core/invoicePlatform/invoiceKnowledgeGraphEngine";

describe("invoiceKnowledgeGraphEngine", () => {
  it("builds an invoice_related_client edge from the invoice to its client", () => {
    const spec = buildInvoiceClientRelationship("inv_1", "client_1");
    expect(spec.relationshipType).toBe("invoice_related_client");
    expect(spec.sourceNode).toEqual({ nodeType: "invoice", nodeId: "inv_1" });
    expect(spec.targetNode).toEqual({ nodeType: "client", nodeId: "client_1" });
  });

  it("builds an invoice_related_contract edge when a contract is linked", () => {
    const specs = buildInvoiceContractRelationship("inv_1", "contract_1");
    expect(specs).toHaveLength(1);
    expect(specs[0].relationshipType).toBe("invoice_related_contract");
    expect(specs[0].targetNode).toEqual({ nodeType: "contract", nodeId: "contract_1" });
  });

  it("returns no contract relationship when no contract is linked", () => {
    expect(buildInvoiceContractRelationship("inv_1", null)).toEqual([]);
  });

  it("builds an invoice_related_proposal edge when a proposal is resolvable", () => {
    const specs = buildInvoiceProposalRelationship("inv_1", "proposal_1");
    expect(specs).toHaveLength(1);
    expect(specs[0].relationshipType).toBe("invoice_related_proposal");
    expect(specs[0].targetNode).toEqual({ nodeType: "proposal", nodeId: "proposal_1" });
  });

  it("returns no proposal relationship when no proposal is resolvable", () => {
    expect(buildInvoiceProposalRelationship("inv_1", null)).toEqual([]);
  });

  it("builds an invoice_related_document edge", () => {
    const spec = buildInvoiceDocumentLinkRelationship("inv_1", "doc_1");
    expect(spec.relationshipType).toBe("invoice_related_document");
    expect(spec.targetNode).toEqual({ nodeType: "document", nodeId: "doc_1" });
  });
});
