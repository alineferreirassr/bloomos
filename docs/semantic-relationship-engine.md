# Semantic Relationship Engine

v2.0 Checkpoint 25, Step 10.6 extends the Enterprise Knowledge Graph (`docs/knowledge-graph.md`, `types/knowledgeGraph.ts`) so a relationship can carry business meaning, not just structural shape. `RELATIONSHIP_TYPE_LABELS` already answers "what kind of edge is this" (Belongs To, Approved By, Used By); `semantics` answers "what does this edge *mean* to the business."

## What was added

`RelationshipSemantics`, nested on `KnowledgeRelationship.semantics` (`null` by default):

```ts
interface RelationshipSemantics {
  role: RelationshipRole | null;              // PRIMARY_CONTRACT, HERO_IMAGE, LEGAL_ATTACHMENT, ...
  businessMeaning: string | null;              // free text
  category: RelationshipCategory | null;       // legal | marketing | operational | financial | brand | reference
  importance: RelationshipImportance | null;   // critical | high | normal | low
  priority: RelationshipPriority | null;       // urgent | high | normal | low
  lifecycle: RelationshipLifecycle | null;     // active | deprecated | superseded | archived
  visibility: RelationshipVisibility | null;   // internal | team | client | public
  ownerMemberId: string | null;                // who's accountable for this meaning staying correct
  businessContext: string | null;
}
```

The 10 named roles (`RELATIONSHIP_ROLES`) match the spec exactly: `primary_contract`, `secondary_document`, `hero_image`, `cover_image`, `legal_attachment`, `marketing_asset`, `internal_reference`, `brand_standard`, `preferred_vendor`, `optional_reference`.

**Confidence is not duplicated.** The spec lists "Confidence" as a semantic property, but `KnowledgeRelationship.confidence` already existed (Step 10.5) for exactly this purpose — 0–100, defaulting to 100 for direct/system-derived edges. Semantics reuses it rather than adding a second field.

**Importance vs. Priority** are kept as two distinct fields, matching the spec's own separate bullets: importance is "how much this matters" (fairly static — a Primary Contract is always critical); priority is "how urgently it needs attention right now" (a Legal Attachment awaiting signature is `urgent` regardless of its importance).

**Lifecycle vs. Status** are also distinct: `RelationshipStatus` (`active` / `archived` / `rejected`) is the edge's own audit state; `RelationshipLifecycle` describes where the *linked content* sits — a still-`active` edge can point at a `superseded` document.

## Never inferred

Every field defaults to `null` and is set only by an explicit user action or a deterministic module rule (e.g. uploading a file into an Event's Hero Image slot sets `role: "hero_image"` on the resulting edge). Nothing in this checkpoint infers semantics from content, filenames, or usage patterns — "Do NOT infer meanings automatically" (spec).

## Where it's set

- `lib/data/core/knowledge/knowledgeGraphStore.ts`'s `createRelationship()` accepts an optional `semantics` on creation.
- `setRelationshipSemantics(id, workspaceId, semantics)` assigns or clears semantics on an existing edge — `null` explicitly resets it to "no meaning assigned yet."
- `modules/knowledgeGraph/knowledgeGraphActions.ts`'s `createRelationshipAction()` / `setRelationshipSemanticsAction()` are the module-layer entry points; both record a Timeline event (`docs/knowledge-graph.md`'s Timeline Integration section).

## Where it's consumed

- **Relationship Constraints Engine** (`docs/relationship-constraints.md`) — a constraint can require a specific `role` (e.g. "an Event needs at least one Hero Image" only counts edges where `semantics.role === "hero_image"`, not any attached asset).
- **Bloom AI Context Layer** (`docs/knowledge-graph.md`'s Bloom AI section) — `generateSemanticContext()` renders every semantically-tagged edge touching a node as prose.
- **Asset Intelligence** and the **Relationship Explorer** both surface `semantics.role` next to each relationship row.

## Tests

`core/knowledge/knowledgeGraphStore.test.ts` and `core/knowledge/relationshipConstraintsEngine.test.ts` cover creation with/without semantics, clearing, and role-scoped constraint counting.
