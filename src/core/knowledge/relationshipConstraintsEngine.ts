import { wouldCreateRelationshipCycle, isValidRelationshipCandidate } from "@/core/knowledge/relationshipEngine";
import { RELATIONSHIP_CONSTRAINTS } from "@/core/knowledge/relationshipConstraintsRegistry";
import type { KnowledgeRelationship, KnowledgeNodeRef, RelationshipType } from "@/types/knowledgeGraph";
import type { RelationshipConstraintRule, ConstraintViolation } from "@/types/relationshipConstraints";

/**
 * v2.0 Checkpoint 25, Step 10.7 — Relationship Constraints Engine. Pure,
 * deterministic, no data access — same discipline as every other engine in
 * `core/knowledge/`. Two entry points: `validateNodeConstraints` audits a
 * node's *existing* relationships against every rule that applies to it
 * (used by Knowledge Health, Step 12, and Asset Intelligence's Constraint
 * Validation section, Step 11); `validateRelationshipMutation` checks a
 * *proposed new* edge before it's created (composing the existing cycle/
 * self-reference guards rather than reimplementing them).
 */

/** Narrowed to the four fields this function actually reads, so callers outside this file (e.g. `core/objectives/progressEngine.ts`, Step 15.6) can reuse it via any object shape that carries them — including `ObjectiveRequirement`'s graph-count variants — without needing to fabricate the unused `RelationshipConstraintRule` fields (`nodeType`/`maxCount`/`severity`). */
export function edgeCountsForRule(node: KnowledgeNodeRef, rule: Pick<RelationshipConstraintRule, "relationshipType" | "direction" | "counterpartNodeType" | "requiredRole">, relationships: KnowledgeRelationship[]): number {
  return relationships.filter((r) => {
    if (r.status !== "active") return false;
    if (r.relationship_type !== rule.relationshipType) return false;

    const nodeIsOnExpectedSide =
      rule.direction === "outbound"
        ? r.source_node_type === node.nodeType && r.source_node_id === node.nodeId
        : r.target_node_type === node.nodeType && r.target_node_id === node.nodeId;
    if (!nodeIsOnExpectedSide) return false;

    const counterpartType = rule.direction === "outbound" ? r.target_node_type : r.source_node_type;
    if (rule.counterpartNodeType && counterpartType !== rule.counterpartNodeType) return false;

    if (rule.requiredRole && r.semantics?.role !== rule.requiredRole) return false;

    return true;
  }).length;
}

/** Every registered rule whose `nodeType` matches this node. */
export function constraintsForNodeType(nodeType: KnowledgeNodeRef["nodeType"]): RelationshipConstraintRule[] {
  return RELATIONSHIP_CONSTRAINTS.filter((rule) => rule.nodeType === nodeType);
}

/**
 * Checks one node's current relationships against every rule that applies
 * to its node type. Returns a violation for each rule breached — a
 * `minCount` shortfall, a `maxCount` overrun, or (implicitly, via `minCount:
 * 1` rules) a required relationship that's altogether missing.
 */
export function validateNodeConstraints(node: KnowledgeNodeRef, relationships: KnowledgeRelationship[]): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  for (const rule of constraintsForNodeType(node.nodeType)) {
    const actualCount = edgeCountsForRule(node, rule, relationships);

    if (rule.minCount !== null && actualCount < rule.minCount) {
      violations.push({
        constraint: rule,
        node,
        actualCount,
        message: `${rule.description} (found ${actualCount}, requires at least ${rule.minCount}.)`,
      });
    }
    if (rule.maxCount !== null && actualCount > rule.maxCount) {
      violations.push({
        constraint: rule,
        node,
        actualCount,
        message: `${rule.description} (found ${actualCount}, allows at most ${rule.maxCount}.)`,
      });
    }
  }

  return violations;
}

export interface RelationshipMutationCheck {
  allowed: boolean;
  hardViolations: string[];
  softWarnings: string[];
}

/**
 * Validates a proposed new relationship before it's created — the single
 * gate a module action should call ahead of `createRelationship`. Composes:
 * self-reference rejection (`isValidRelationshipCandidate`), circular
 * reference protection (`wouldCreateRelationshipCycle`), and a `maxCount`
 * pre-check for the source node's outbound rules (so e.g. a second
 * `belongs_to` edge on an Invoice that already has one is caught before
 * creation, not just flagged afterward by `validateNodeConstraints`).
 */
export function validateRelationshipMutation(
  source: KnowledgeNodeRef,
  target: KnowledgeNodeRef,
  relationshipType: RelationshipType,
  existingRelationships: KnowledgeRelationship[],
): RelationshipMutationCheck {
  const hardViolations: string[] = [];
  const softWarnings: string[] = [];

  if (!isValidRelationshipCandidate(source, target)) {
    hardViolations.push("A relationship must connect two distinct, well-formed records.");
  }
  if (wouldCreateRelationshipCycle(source, target, relationshipType, existingRelationships)) {
    hardViolations.push("This relationship would create a circular reference.");
  }

  for (const rule of constraintsForNodeType(source.nodeType).filter((r) => r.relationshipType === relationshipType && r.direction === "outbound")) {
    if (rule.maxCount === null) continue;
    const currentCount = edgeCountsForRule(source, rule, existingRelationships);
    if (currentCount + 1 > rule.maxCount) {
      const message = `${rule.description} (already has ${currentCount}, allows at most ${rule.maxCount}.)`;
      if (rule.severity === "hard") hardViolations.push(message);
      else softWarnings.push(message);
    }
  }

  return { allowed: hardViolations.length === 0, hardViolations, softWarnings };
}
