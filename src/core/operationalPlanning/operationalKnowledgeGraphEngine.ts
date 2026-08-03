import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 27.2, Step 17 — Knowledge Graph Integration. Pure
 * builders — never a fabricated node. `OperationalPlan`/`ExecutionPhase`/
 * `ExecutionStep`/`Milestone`/`EvidenceRequirement`/`ApprovalRequirement`
 * have no node identity of their own (plain records inside a plan's own
 * aggregate document, not Knowledge Graph nodes) — the same discipline
 * `CapabilityRequirement`/`Calendar`/`Allocation` held to before them.
 * `produces_deliverable` is the one live edge this checkpoint emits:
 * a plan's own context node → the real Document/MediaAsset node a
 * `Deliverable.linked_node` names, when set. `operationalPlanningActions.ts`
 * is responsible for actually persisting whatever this builder returns
 * via the Knowledge Graph service.
 */

export type OperationalRelationshipType = "produces_deliverable";

export interface OperationalRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: OperationalRelationshipType;
}

/** `produces_deliverable`: a plan's own context node → the real artifact node a `Deliverable.linked_node` names. `null` when either side has no real node — never fabricated. */
export function buildProducesDeliverableRelationship(planContext: KnowledgeNodeRef | null, deliverableLinkedNode: KnowledgeNodeRef | null): OperationalRelationshipSpec | null {
  if (planContext === null || deliverableLinkedNode === null) return null;
  return { sourceNode: planContext, targetNode: deliverableLinkedNode, relationshipType: "produces_deliverable" };
}
