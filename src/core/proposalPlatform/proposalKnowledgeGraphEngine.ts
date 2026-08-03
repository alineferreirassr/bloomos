import type { KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";
import type { ProposalSnapshot } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33 — Knowledge Graph Integration (Step 15). Pure spec
 * builders, the exact `buildAssignedResourceRelationship` pattern Dispatch
 * established (`core/dispatch/dispatchKnowledgeGraphEngine.ts`, Checkpoint
 * 28) — this file never calls the Knowledge Graph store itself, only
 * describes the edges a module action should create.
 */

export interface ProposalRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: RelationshipType;
}

function proposalNode(proposalId: string): KnowledgeNodeRef {
  return { nodeType: "proposal", nodeId: proposalId };
}

/** Edges describing what a proposal's current document is built FROM — template/packages/add-ons/client — recomputed each time a version publishes, never stored redundantly. */
export function buildProposalDocumentRelationships(proposalId: string, clientId: string, snapshot: ProposalSnapshot | null): ProposalRelationshipSpec[] {
  const specs: ProposalRelationshipSpec[] = [{ sourceNode: proposalNode(proposalId), targetNode: { nodeType: "client", nodeId: clientId }, relationshipType: "proposal_related_client" }];

  if (!snapshot) return specs;

  if (snapshot.template_id) {
    specs.push({ sourceNode: proposalNode(proposalId), targetNode: { nodeType: "proposal_template", nodeId: snapshot.template_id }, relationshipType: "proposal_uses_template" });
  }
  for (const packageId of snapshot.packageIds) {
    specs.push({ sourceNode: proposalNode(proposalId), targetNode: { nodeType: "proposal_package", nodeId: packageId }, relationshipType: "proposal_contains_package" });
  }
  for (const addonId of snapshot.addonIds) {
    specs.push({ sourceNode: proposalNode(proposalId), targetNode: { nodeType: "proposal_addon", nodeId: addonId }, relationshipType: "proposal_contains_addon" });
  }

  return specs;
}

/** Edges along the EXISTING `ProposalDraft.parent_proposal_id`/`"superseded"` chain (Checkpoint 3) — both fire together whenever a regeneration supersedes a prior draft, since that's the one moment both relationships become true at once. */
export function buildProposalVersionChainRelationships(proposalId: string, parentProposalId: string | null): ProposalRelationshipSpec[] {
  if (!parentProposalId) return [];
  return [
    { sourceNode: proposalNode(proposalId), targetNode: proposalNode(parentProposalId), relationshipType: "proposal_version_of" },
    { sourceNode: proposalNode(proposalId), targetNode: proposalNode(parentProposalId), relationshipType: "proposal_supersedes" },
  ];
}

export function buildProposalDocumentRelationship(proposalId: string, documentId: string): ProposalRelationshipSpec {
  return { sourceNode: proposalNode(proposalId), targetNode: { nodeType: "document", nodeId: documentId }, relationshipType: "proposal_related_document" };
}
