# Relationship Constraints Engine

v2.0 Checkpoint 25, Step 10.7. A reusable, declarative validation layer over the Knowledge Graph (`core/knowledge/relationshipConstraintsEngine.ts`, rules registered in `core/knowledge/relationshipConstraintsRegistry.ts`). Every entity type's relationship rules — required/optional, min/max count, per-role — live in one array; adding a rule for a new entity type is a one-line addition, never a new validation code path.

## What it does not reimplement

Two of the spec's own bullets — **Circular Protection** and **Workspace Isolation** — are deliberately absent as new logic here, because both already exist structurally:

- Circular Protection is `core/knowledge/relationshipEngine.ts`'s `wouldCreateRelationshipCycle()` (Step 10.5).
- Workspace Isolation is structural in `knowledgeGraphStore.listRelationshipsForWorkspace()` — a relationship from another workspace is never in the array to begin with.

`validateRelationshipMutation()` (below) composes both rather than re-declaring them, matching this checkpoint's own stop condition ("Do NOT duplicate graph logic").

Likewise, "Asset cannot reference itself" and "Folder cannot become its own descendant" are enforced by `isValidRelationshipCandidate()` and `wouldCreateFolderCycle()` respectively — not re-declared as constraint rules.

## Rule shape

```ts
interface RelationshipConstraintRule {
  id: string;
  nodeType: KnowledgeNodeType;              // which entity type this rule is declared for
  relationshipType: RelationshipType;
  direction: "outbound" | "inbound";        // which side of the edge nodeType sits on
  counterpartNodeType: KnowledgeNodeType | null;
  requiredRole: RelationshipRole | null;    // Step 10.6 integration — only count edges with this semantic role
  minCount: number | null;
  maxCount: number | null;
  severity: "soft" | "hard";                // hard blocks the mutation; soft only warns (surfaced in Knowledge Health)
  description: string;
}
```

## Registered rules (`relationshipConstraintsRegistry.ts`)

| Rule | Node | Requirement |
|---|---|---|
| `invoice_belongs_to_exactly_one_proposal` | Invoice | exactly 1 Proposal (hard) |
| `proposal_belongs_to_one_client` | Proposal | exactly 1 Client (hard) |
| `event_requires_at_least_one_hero_image` | Event | at least 1 asset with `semantics.role === "hero_image"` (soft) |
| `client_may_have_many_contracts` | Client | no min/max — deliberately unconstrained |

## Two entry points

- **`validateNodeConstraints(node, relationships)`** — audits a node's *existing* relationships against every rule declared for its type. Used by Knowledge Health (Step 12) and Asset Intelligence's Constraint Validation section (Step 11).
- **`validateRelationshipMutation(source, target, relationshipType, existingRelationships)`** — checks a *proposed new* edge before creation: self-reference, cycle, and a `maxCount` pre-check on the source node's own outbound rules (so a second Proposal on an already-linked Invoice is rejected at creation time, not just flagged afterward). Returns `{ allowed, hardViolations, softWarnings }`.

`modules/knowledgeGraph/knowledgeGraphActions.ts`'s `createRelationshipAction()` calls `validateRelationshipMutation()` before every create, and records a `knowledge_relationship_constraint_violated` Timeline event when it blocks one.

## Tests

`core/knowledge/relationshipConstraintsEngine.test.ts` — 10 cases covering minCount/maxCount violations, role-scoped counting, cycle/self-reference blocking, and the "Client may have many Contracts" unconstrained case.
