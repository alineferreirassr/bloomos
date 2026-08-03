import { detectOrphanedAssets, findDuplicateRelationships, type DetectOrphanedAssetsInput } from "@/core/knowledge/orphanDetectionEngine";
import { validateNodeConstraints } from "@/core/knowledge/relationshipConstraintsEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef, OrphanedAssetFinding } from "@/types/knowledgeGraph";
import type { ConstraintViolation } from "@/types/relationshipConstraints";

/**
 * v2.0 Checkpoint 25, Step 12 — Knowledge Health Engine. A pure composition
 * layer over engines that already exist (`orphanDetectionEngine`,
 * `relationshipConstraintsEngine`) plus one genuinely new check
 * (`findBrokenRelationships`/`findCircularReferenceGroups`) — never a
 * reimplementation of orphan/duplicate detection, matching the spec's own
 * "extend, don't duplicate" discipline.
 *
 * Two spec-named categories ("Unused Templates", "Expired Assets") are
 * deliberately absent from `KnowledgeHealthReport` and listed under
 * `notApplicable` instead: MediaAsset has no expiry-date field this
 * checkpoint (unlike Document's own `expires_at`), and "Template" here
 * refers to the separate Document Intelligence Platform's `ComposedDocument`
 * system, out of scope for the Knowledge Graph — see docs/knowledge-health.md.
 */

const HIERARCHICAL_RELATIONSHIP_TYPES = new Set(["previous_version_of", "next_version_of", "belongs_to", "included_in", "derived_from"]);

function nodeKey(node: KnowledgeNodeRef): string {
  return `${node.nodeType}:${node.nodeId}`;
}

/** A relationship whose source or target node is not in the caller-supplied set of known-existing nodes — the general form of "linked_to_deleted_entity," not scoped to assets alone. */
export function findBrokenRelationships(relationships: KnowledgeRelationship[], existingNodeKeys: Set<string>): KnowledgeRelationship[] {
  return relationships.filter((r) => {
    if (r.status !== "active") return false;
    const sourceKey = nodeKey({ nodeType: r.source_node_type, nodeId: r.source_node_id });
    const targetKey = nodeKey({ nodeType: r.target_node_type, nodeId: r.target_node_id });
    return !existingNodeKeys.has(sourceKey) || !existingNodeKeys.has(targetKey);
  });
}

/**
 * Defensive audit for a cycle that already exists among hierarchical edges
 * — `relationshipEngine.wouldCreateRelationshipCycle` prevents new ones at
 * creation time, so a live cycle here would mean corrupt data (e.g. a
 * future migration or direct store write), not normal operation.
 */
export function findCircularReferenceGroups(relationships: KnowledgeRelationship[]): KnowledgeRelationship[][] {
  const groups: KnowledgeRelationship[][] = [];

  for (const relType of HIERARCHICAL_RELATIONSHIP_TYPES) {
    const edges = relationships.filter((r) => r.relationship_type === relType && r.status === "active");
    const byNode = new Map<string, KnowledgeRelationship[]>();
    for (const edge of edges) {
      const key = nodeKey({ nodeType: edge.source_node_type, nodeId: edge.source_node_id });
      const bucket = byNode.get(key) ?? [];
      bucket.push(edge);
      byNode.set(key, bucket);
    }

    for (const startEdge of edges) {
      const startKey = nodeKey({ nodeType: startEdge.source_node_type, nodeId: startEdge.source_node_id });
      const visited = new Set<string>([startKey]);
      const path: KnowledgeRelationship[] = [startEdge];
      let current = nodeKey({ nodeType: startEdge.target_node_type, nodeId: startEdge.target_node_id });

      while (true) {
        if (current === startKey) {
          groups.push([...path]);
          break;
        }
        if (visited.has(current)) break;
        visited.add(current);
        const next = (byNode.get(current) ?? [])[0];
        if (!next) break;
        path.push(next);
        current = nodeKey({ nodeType: next.target_node_type, nodeId: next.target_node_id });
      }
    }
  }

  return groups;
}

export interface KnowledgeHealthReport {
  brokenRelationships: KnowledgeRelationship[];
  orphanedAssets: OrphanedAssetFinding[];
  duplicateRelationshipGroups: KnowledgeRelationship[][];
  circularReferenceGroups: KnowledgeRelationship[][];
  constraintViolations: ConstraintViolation[];
  notApplicable: string[];
}

export interface ComputeKnowledgeHealthInput extends DetectOrphanedAssetsInput {
  /** Every node this workspace is prepared to constraint-check — typically the source/target of every relationship, deduplicated by the caller. */
  nodesToValidate: KnowledgeNodeRef[];
}

export function computeKnowledgeHealth(input: ComputeKnowledgeHealthInput): KnowledgeHealthReport {
  const constraintViolations = input.nodesToValidate.flatMap((node) => validateNodeConstraints(node, input.relationships));

  return {
    brokenRelationships: findBrokenRelationships(input.relationships, input.existingNodeKeys),
    orphanedAssets: detectOrphanedAssets(input),
    duplicateRelationshipGroups: findDuplicateRelationships(input.relationships),
    circularReferenceGroups: findCircularReferenceGroups(input.relationships),
    constraintViolations,
    notApplicable: ["unused_templates", "expired_assets"],
  };
}
