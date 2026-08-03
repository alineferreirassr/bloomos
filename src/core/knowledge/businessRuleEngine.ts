import { validateNodeConstraints } from "@/core/knowledge/relationshipConstraintsEngine";
import { findCircularReferenceGroups } from "@/core/knowledge/knowledgeHealthEngine";
import type { KnowledgeRelationship, KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { BusinessRuleViolation } from "@/types/businessHealth";
import type { MediaFolder } from "@/types/mediaFolder";

/**
 * v2.0 Checkpoint 25, Step 15.5 — Business Rule Engine. Deliberately thin:
 * it translates violations already computed by `relationshipConstraintsEngine`
 * (Step 10.7) and `knowledgeHealthEngine` (Step 12) into one uniform
 * `BusinessRuleViolation[]` shape, and adds exactly one genuinely new check
 * (`findInvalidParentFolders`) that neither engine covers. This is not a
 * second validation engine — every rule id it produces traces back to a
 * rule already declared in `relationshipConstraintsRegistry.ts`, or to one
 * of the two named checks below.
 *
 * Two of the spec's own named violation examples are intentionally not
 * re-declared here:
 * - "Asset without Owner" is `orphanDetectionEngine`'s own
 *   `no_relationships` / `linked_to_deleted_entity` findings — surfaced via
 *   `WorkspaceHealthEngine`'s `assetsWithoutOwners` count, not duplicated
 *   as a second check.
 * - "Broken Relationships" is `knowledgeHealthEngine.findBrokenRelationships` —
 *   likewise surfaced through `WorkspaceHealthEngine`, not re-implemented.
 */

/** A folder whose `parent_folder_id` points at an id that doesn't exist in the given folder set — data corruption `wouldCreateFolderCycle` (a pre-move guard) can't catch, since nothing ever proposed this exact state as a move. */
export function findInvalidParentFolders(folders: MediaFolder[]): MediaFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  return folders.filter((f) => f.parent_folder_id !== null && !byId.has(f.parent_folder_id));
}

export interface ComputeBusinessRuleViolationsInput {
  /** Every node whose declared constraints should be checked — typically every relationship's source/target endpoint, deduplicated by the caller (same convention as `KnowledgeHealthEngine`'s own `nodesToValidate`). */
  nodesToValidate: KnowledgeNodeRef[];
  relationships: KnowledgeRelationship[];
  folders: MediaFolder[];
}

export function computeBusinessRuleViolations(input: ComputeBusinessRuleViolationsInput): BusinessRuleViolation[] {
  const violations: BusinessRuleViolation[] = [];

  for (const node of input.nodesToValidate) {
    for (const v of validateNodeConstraints(node, input.relationships)) {
      violations.push({ ruleId: v.constraint.id, description: v.message, node: v.node, severity: v.constraint.severity });
    }
  }

  for (const group of findCircularReferenceGroups(input.relationships)) {
    const first = group[0];
    violations.push({
      ruleId: "circular_dependency",
      description: `Circular reference detected among ${group.length} relationship${group.length === 1 ? "" : "s"}.`,
      node: { nodeType: first.source_node_type, nodeId: first.source_node_id },
      severity: "hard",
    });
  }

  for (const folder of findInvalidParentFolders(input.folders)) {
    violations.push({
      ruleId: "invalid_parent_folder",
      description: `Folder "${folder.name}" references a parent folder that no longer exists.`,
      node: { nodeType: "media_folder", nodeId: folder.id },
      severity: "hard",
    });
  }

  return violations;
}
