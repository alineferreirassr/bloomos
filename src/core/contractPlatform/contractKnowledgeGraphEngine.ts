import type { KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";
import type { ContractSnapshot } from "@/types/contractPlatform";

/**
 * v2.0 Checkpoint 34 — Knowledge Graph Integration (Step 14). Pure spec
 * builders, the same `buildProposalDocumentRelationships` pattern Proposal
 * Platform established (`core/proposalPlatform/proposalKnowledgeGraphEngine.ts`,
 * Checkpoint 33) — this file never calls the Knowledge Graph store itself,
 * only describes the edges a module action should create. All IDs (Proposal
 * link via shared `event_id`, Document links) are resolved by the caller
 * and passed in already-known — this file does no I/O of its own.
 */

export interface ContractRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: RelationshipType;
}

function contractNode(contractId: string): KnowledgeNodeRef {
  return { nodeType: "contract", nodeId: contractId };
}

/** Edges describing what a contract's current document is built FROM — builder template, clauses, and the linked client — recomputed each time a version publishes, never stored redundantly. */
export function buildContractDocumentRelationships(contractId: string, clientId: string, snapshot: ContractSnapshot | null): ContractRelationshipSpec[] {
  const specs: ContractRelationshipSpec[] = [{ sourceNode: contractNode(contractId), targetNode: { nodeType: "client", nodeId: clientId }, relationshipType: "contract_related_client" }];

  if (!snapshot) return specs;

  if (snapshot.builderTemplateId) {
    specs.push({ sourceNode: contractNode(contractId), targetNode: { nodeType: "contract_builder_template", nodeId: snapshot.builderTemplateId }, relationshipType: "contract_uses_template" });
  }
  for (const clauseId of snapshot.clauseIds) {
    specs.push({ sourceNode: contractNode(contractId), targetNode: { nodeType: "contract_clause", nodeId: clauseId }, relationshipType: "contract_contains_clause" });
  }

  return specs;
}

/** The one indirect link this checkpoint resolves — via the contract's own `event_id`, since no direct Proposal FK exists (see `types/contractPlatform.ts`). */
export function buildContractProposalRelationship(contractId: string, proposalId: string | null): ContractRelationshipSpec[] {
  if (!proposalId) return [];
  return [{ sourceNode: contractNode(contractId), targetNode: { nodeType: "proposal", nodeId: proposalId }, relationshipType: "contract_related_proposal" }];
}

export function buildContractDocumentLinkRelationship(contractId: string, documentId: string): ContractRelationshipSpec {
  return { sourceNode: contractNode(contractId), targetNode: { nodeType: "document", nodeId: documentId }, relationshipType: "contract_related_document" };
}
