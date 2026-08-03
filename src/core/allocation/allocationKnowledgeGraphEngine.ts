import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { RESOURCE_TYPE_TO_NODE_TYPE, type ResourceType } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 17 — Knowledge Graph Integration. Pure
 * builders — never a fabricated node. `"asset"`/`"custom"` resource
 * types have no matching `KnowledgeNodeType` (see
 * `RESOURCE_TYPES_WITH_NO_NODE` in `types/allocation.ts`), so any
 * relationship touching one of them resolves to `null` rather than
 * inventing a node. `allocationActions.ts` (Step 22) is responsible for
 * actually persisting whatever these builders return via the Knowledge
 * Graph service.
 */

export type AllocationRelationshipType = "allocated_to" | "depends_on" | "backup_for" | "shares_resource_with";

export interface AllocationRelationshipSpec {
  sourceNode: KnowledgeNodeRef;
  targetNode: KnowledgeNodeRef;
  relationshipType: AllocationRelationshipType;
}

interface ResourceRef {
  resource_type: ResourceType;
  resource_id: string;
}

function toNodeRef(resource: ResourceRef): KnowledgeNodeRef | null {
  const nodeType = RESOURCE_TYPE_TO_NODE_TYPE[resource.resource_type];
  if (nodeType === undefined) return null;
  return { nodeType, nodeId: resource.resource_id };
}

/** `allocated_to`: a selected candidate resource → the request's own context node. */
export function buildAllocatedToRelationship(candidate: ResourceRef, requestContext: KnowledgeNodeRef | null): AllocationRelationshipSpec | null {
  if (requestContext === null) return null;
  const candidateNode = toNodeRef(candidate);
  if (candidateNode === null) return null;
  return { sourceNode: candidateNode, targetNode: requestContext, relationshipType: "allocated_to" };
}

/** `depends_on`: the subject resource (e.g. a Drone) → the co-allocated resource satisfying its dependency (e.g. its certified operator). */
export function buildDependsOnRelationship(subject: ResourceRef, requiredResource: ResourceRef): AllocationRelationshipSpec | null {
  const subjectNode = toNodeRef(subject);
  const requiredNode = toNodeRef(requiredResource);
  if (subjectNode === null || requiredNode === null) return null;
  return { sourceNode: subjectNode, targetNode: requiredNode, relationshipType: "depends_on" };
}

/** `backup_for`: a fallback resource → the primary resource it stands in for. */
export function buildBackupForRelationship(backup: ResourceRef, primary: ResourceRef): AllocationRelationshipSpec | null {
  const backupNode = toNodeRef(backup);
  const primaryNode = toNodeRef(primary);
  if (backupNode === null || primaryNode === null) return null;
  return { sourceNode: backupNode, targetNode: primaryNode, relationshipType: "backup_for" };
}

function nodeSortKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

/** `shares_resource_with`: two requests' own context nodes that were allocated the same resource — direction is sorted deterministically (never by time, since there's no inherent ordering) so the same pair never produces two mirrored edges. */
export function buildSharesResourceWithRelationship(contextA: KnowledgeNodeRef | null, contextB: KnowledgeNodeRef | null): AllocationRelationshipSpec | null {
  if (contextA === null || contextB === null) return null;
  const [sourceNode, targetNode] = nodeSortKey(contextA) <= nodeSortKey(contextB) ? [contextA, contextB] : [contextB, contextA];
  return { sourceNode, targetNode, relationshipType: "shares_resource_with" };
}
