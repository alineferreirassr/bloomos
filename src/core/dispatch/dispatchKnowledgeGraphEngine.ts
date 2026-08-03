import type { KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";
import { RESOURCE_TYPE_TO_NODE_TYPE, type ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 28, Step 10 — Knowledge Graph Integration. Pure
 * builders — never a fabricated node. `DispatchOrder`/`DispatchAssignment`/
 * `DispatchBatch` have no node identity of their own (plain records,
 * the same discipline `ExecutionPackage`/`OperationalPlan` held to
 * before them). `assigned_worker`/`assigned_vehicle`/`assigned_equipment`
 * are the 3 live edges: a Dispatch Order's own context node (reused from
 * its Execution Package's `ExecutionContext.context`) → the real Worker/
 * Vehicle/Equipment node an assignment names, since — unlike Execution
 * Package/Allocation/Operational Plan — a Worker/Vehicle/Equipment IS a
 * real `KnowledgeNodeType`. `dispatchActions.ts` is responsible for
 * actually persisting whatever this builder returns via the Knowledge
 * Graph service.
 */

const ASSIGNED_RELATIONSHIP_BY_RESOURCE_TYPE: Partial<Record<ResourceType, RelationshipType>> = {
  worker: "assigned_worker",
  vehicle: "assigned_vehicle",
  equipment: "assigned_equipment",
};

export interface DispatchRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: RelationshipType;
}

/** `null` when the order has no real context node, or the resource type isn't one of the 3 the spec names (worker/vehicle/equipment) — team and vendor assignments deliberately get no edge. */
export function buildAssignedResourceRelationship(orderContext: KnowledgeNodeRef | null, resourceType: ResourceType, resourceId: string): DispatchRelationshipSpec | null {
  if (orderContext === null) return null;
  const relationshipType = ASSIGNED_RELATIONSHIP_BY_RESOURCE_TYPE[resourceType];
  if (relationshipType === undefined) return null;
  const nodeType = RESOURCE_TYPE_TO_NODE_TYPE[resourceType];
  if (nodeType === undefined) return null;
  return { sourceNode: orderContext, targetNode: { nodeType, nodeId: resourceId }, relationshipType };
}
