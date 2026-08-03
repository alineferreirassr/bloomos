import type { KnowledgeNodeType, KnowledgeNodeRef, RelationshipType, RelationshipRole } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 25, Step 10.7 — Relationship Constraints Engine types.
 * A constraint is always declared *from the perspective of one node type*
 * ("an Invoice must belong to exactly one Proposal"), checked against
 * whichever side of the edge (`direction`) that node type sits on.
 *
 * This layer never reimplements cycle detection or workspace isolation —
 * those already exist and are structural (`relationshipEngine.ts`'s
 * `wouldCreateRelationshipCycle`, and the store's own workspace-scoped
 * fetch). `validateRelationshipMutation` below composes them rather than
 * duplicating them, matching the spec's own "Circular Protection /
 * Workspace Isolation" bullets as *supported*, not *reinvented*.
 */

/** `"hard"` blocks the mutation outright; `"soft"` surfaces a warning (e.g. in Knowledge Health, Step 12) but never blocks a save. */
export type ConstraintSeverity = "soft" | "hard";

export interface RelationshipConstraintRule {
  id: string;
  nodeType: KnowledgeNodeType;
  relationshipType: RelationshipType;
  /** Which side of the edge `nodeType` occupies — "outbound" means `nodeType` is always the edge's source. */
  direction: "outbound" | "inbound";
  /** The node type on the other end this rule counts against, or `null` for "any counterpart type." */
  counterpartNodeType: KnowledgeNodeType | null;
  /** Step 10.6 integration — when set, only edges whose `semantics.role` matches count toward this rule (e.g. "at least one Hero Image", not just any attached asset). */
  requiredRole: RelationshipRole | null;
  minCount: number | null;
  maxCount: number | null;
  severity: ConstraintSeverity;
  description: string;
}

export interface ConstraintViolation {
  constraint: RelationshipConstraintRule;
  node: KnowledgeNodeRef;
  actualCount: number;
  message: string;
}
