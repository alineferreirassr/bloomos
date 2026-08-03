import type { KnowledgeRelationship, KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 25, Step 10.5 — pure relationship validation. Mirrors
 * `core/workflows/documentFolderWorkflow.ts`'s own `wouldCreateFolderCycle`
 * — the one prior precedent in this codebase for "prevent a cyclical
 * parent/child structure" — generalized from folders to any hierarchical
 * relationship type. Nothing here fetches data; the module layer passes in
 * the workspace's already-fetched relationship array.
 */

/** Relationship types where a cycle (A → B → A, or a longer loop) would be a real structural error, not just a redundant edge — version chains and containment. */
const HIERARCHICAL_RELATIONSHIP_TYPES: ReadonlySet<RelationshipType> = new Set([
  "previous_version_of",
  "next_version_of",
  "belongs_to",
  "included_in",
  "derived_from",
]);

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

/**
 * Would adding `candidateType` from `source` to `target` create a cycle,
 * given the relationships that already exist? Only checked for
 * `HIERARCHICAL_RELATIONSHIP_TYPES` — a `related_to`/`mentioned_in` mesh is
 * expected to have many-directional edges and is never cyclical in the
 * structural sense this guards against.
 */
export function wouldCreateRelationshipCycle(
  source: KnowledgeNodeRef,
  target: KnowledgeNodeRef,
  candidateType: RelationshipType,
  existingRelationships: KnowledgeRelationship[],
): boolean {
  if (!HIERARCHICAL_RELATIONSHIP_TYPES.has(candidateType)) return false;
  if (nodeKey(source) === nodeKey(target)) return true;

  // Walk forward from `target` along same-type edges; if we ever reach `source`, adding source→target would close a loop.
  const sameTypeEdges = existingRelationships.filter((r) => r.relationship_type === candidateType && r.status === "active");
  const visited = new Set<string>([nodeKey(target)]);
  const queue: KnowledgeNodeRef[] = [target];

  while (queue.length > 0) {
    const current = queue.shift() as KnowledgeNodeRef;
    const next = sameTypeEdges.filter((r) => r.source_node_type === current.nodeType && r.source_node_id === current.nodeId);
    for (const edge of next) {
      const nextNode: KnowledgeNodeRef = { nodeType: edge.target_node_type, nodeId: edge.target_node_id };
      if (nodeKey(nextNode) === nodeKey(source)) return true;
      const key = nodeKey(nextNode);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(nextNode);
      }
    }
  }
  return false;
}

/** A relationship is only valid between two different, well-formed node refs — never a placeholder/empty id, matching the spec's own "Validate Source and Target Entities" requirement. The module layer is responsible for confirming the referenced entity actually exists (this engine has no data access); this is the structural half of validation. */
export function isValidRelationshipCandidate(source: KnowledgeNodeRef, target: KnowledgeNodeRef): boolean {
  return source.nodeId.trim().length > 0 && target.nodeId.trim().length > 0 && !(source.nodeType === target.nodeType && source.nodeId === target.nodeId);
}
