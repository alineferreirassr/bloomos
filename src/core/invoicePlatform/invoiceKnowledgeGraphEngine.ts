import type { KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 35 — Knowledge Graph Integration (Step 16). Pure spec
 * builders, the same `buildContractDocumentRelationships`/
 * `buildContractProposalRelationship` pattern Contract Platform established
 * (`core/contractPlatform/contractKnowledgeGraphEngine.ts`, Checkpoint 34)
 * — this file never calls the Knowledge Graph store itself, only describes
 * the edges a module action should create. All IDs are resolved by the
 * caller and passed in already-known — this file does no I/O of its own.
 * Unlike Contract, `invoice_related_client`/`invoice_related_contract` both
 * resolve from the real `Invoice`'s own direct `client_id`/`contract_id`
 * fields — no `event_id` indirection needed for either. Only
 * `invoice_related_proposal` still needs the indirect, shared-`event_id`
 * resolution, since no direct Proposal FK exists on `Invoice`.
 */

export interface InvoiceRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: RelationshipType;
}

function invoiceNode(invoiceId: string): KnowledgeNodeRef {
  return { nodeType: "invoice", nodeId: invoiceId };
}

export function buildInvoiceClientRelationship(invoiceId: string, clientId: string): InvoiceRelationshipSpec {
  return { sourceNode: invoiceNode(invoiceId), targetNode: { nodeType: "client", nodeId: clientId }, relationshipType: "invoice_related_client" };
}

/** Direct FK on the real `Invoice` — no indirection needed, unlike Contract's own Proposal link. */
export function buildInvoiceContractRelationship(invoiceId: string, contractId: string | null): InvoiceRelationshipSpec[] {
  if (!contractId) return [];
  return [{ sourceNode: invoiceNode(invoiceId), targetNode: { nodeType: "contract", nodeId: contractId }, relationshipType: "invoice_related_contract" }];
}

/** The one indirect link this checkpoint resolves — via the invoice's own `event_id`, since no direct Proposal FK exists on `Invoice`. */
export function buildInvoiceProposalRelationship(invoiceId: string, proposalId: string | null): InvoiceRelationshipSpec[] {
  if (!proposalId) return [];
  return [{ sourceNode: invoiceNode(invoiceId), targetNode: { nodeType: "proposal", nodeId: proposalId }, relationshipType: "invoice_related_proposal" }];
}

export function buildInvoiceDocumentLinkRelationship(invoiceId: string, documentId: string): InvoiceRelationshipSpec {
  return { sourceNode: invoiceNode(invoiceId), targetNode: { nodeType: "document", nodeId: documentId }, relationshipType: "invoice_related_document" };
}
