import type { RelationshipConstraintRule } from "@/types/relationshipConstraints";

/**
 * v2.0 Checkpoint 25, Step 10.7 — the declarative rule set every entity
 * type's relationships are checked against. Adding a rule for a new entity
 * type is a one-line addition here, never a new validation code path.
 *
 * "Asset cannot reference itself" and "Folder cannot become its own
 * descendant" are deliberately absent — both are already enforced
 * structurally (`isValidRelationshipCandidate`, `wouldCreateRelationshipCycle`,
 * `wouldCreateFolderCycle`), so re-declaring them here would be the exact
 * duplication the spec's stop condition forbids.
 */
export const RELATIONSHIP_CONSTRAINTS: RelationshipConstraintRule[] = [
  {
    id: "invoice_belongs_to_exactly_one_proposal",
    nodeType: "invoice",
    relationshipType: "belongs_to",
    direction: "outbound",
    counterpartNodeType: "proposal",
    requiredRole: null,
    minCount: 1,
    maxCount: 1,
    severity: "hard",
    description: "An Invoice must belong to exactly one Proposal.",
  },
  {
    id: "proposal_belongs_to_one_client",
    nodeType: "proposal",
    relationshipType: "belongs_to",
    direction: "outbound",
    counterpartNodeType: "client",
    requiredRole: null,
    minCount: 1,
    maxCount: 1,
    severity: "hard",
    description: "A Proposal must belong to one Client.",
  },
  {
    id: "event_requires_at_least_one_hero_image",
    nodeType: "event",
    relationshipType: "used_by",
    direction: "inbound",
    counterpartNodeType: "media_asset",
    requiredRole: "hero_image",
    minCount: 1,
    maxCount: null,
    severity: "soft",
    description: "An Event should have at least one Hero Image.",
  },
  {
    id: "client_may_have_many_contracts",
    nodeType: "client",
    relationshipType: "belongs_to",
    direction: "inbound",
    counterpartNodeType: "contract",
    requiredRole: null,
    minCount: null,
    maxCount: null,
    severity: "soft",
    description: "A Client may have many Contracts.",
  },
  // v2.0 Checkpoint 25, Step 15.5 — Operational Intelligence Layer, Business
  // Rule Violations' own "Multiple Primary Contracts" example.
  {
    id: "event_at_most_one_primary_contract",
    nodeType: "event",
    relationshipType: "associated_with_event",
    direction: "inbound",
    counterpartNodeType: "contract",
    requiredRole: "primary_contract",
    minCount: null,
    maxCount: 1,
    severity: "hard",
    description: "An Event may have at most one Primary Contract.",
  },
];
