# Knowledge Health Engine

v2.0 Checkpoint 25, Step 12. `core/knowledge/knowledgeHealthEngine.ts` composes existing engines into one deterministic health report — it introduces exactly two genuinely new checks (`findBrokenRelationships`, `findCircularReferenceGroups`) and reuses everything else.

```ts
interface KnowledgeHealthReport {
  brokenRelationships: KnowledgeRelationship[];
  orphanedAssets: OrphanedAssetFinding[];
  duplicateRelationshipGroups: KnowledgeRelationship[][];
  circularReferenceGroups: KnowledgeRelationship[][];
  constraintViolations: ConstraintViolation[];
  notApplicable: string[];
}
```

## What's reused, not reimplemented

- **Orphaned Assets** — `orphanDetectionEngine.detectOrphanedAssets()` (Step 10.5), unchanged.
- **Duplicate References** — `orphanDetectionEngine.findDuplicateRelationships()` (Step 10.5), unchanged.
- **Invalid Constraints** — `relationshipConstraintsEngine.validateNodeConstraints()` (Step 10.7), run across every node the graph currently knows about.
- **Missing Hero Images / Missing Contracts / Missing Required Documents** — these are exactly the `minCount`-violation subset of `constraintViolations` (the `event_requires_at_least_one_hero_image` / `invoice_belongs_to_exactly_one_proposal` / `proposal_belongs_to_one_client` rules) — not a separate check.

## What's new

- **`findBrokenRelationships(relationships, existingNodeKeys)`** — the general form of "linked to a deleted entity," not scoped to Media Assets alone (unlike the orphan detector's own `linked_to_deleted_entity` reason, which only checks an asset's owner). Flags any active relationship whose source *or* target node isn't in the caller-supplied set of known-existing nodes.
- **`findCircularReferenceGroups(relationships)`** — a defensive audit for a cycle that already exists among hierarchical edges (`belongs_to`, `included_in`, `derived_from`, `previous_version_of`, `next_version_of`). `relationshipEngine.wouldCreateRelationshipCycle()` prevents *new* cycles at creation time (Step 10.5); a live cycle found here would mean corrupt data from a migration or direct store write, not normal operation — it should never fire in practice, which is exactly why it's worth auditing for.

## Deliberately out of scope (`notApplicable`)

Two spec-named categories are absent from the computed report and listed in `notApplicable` instead of being faked:

- **"Unused Templates"** — refers to the separate Document Intelligence Platform's `ComposedDocument`/Template system (Checkpoint 12), not the Knowledge Graph. Out of scope for this checkpoint; conflating the two would have meant touching a system this checkpoint was explicitly told not to touch.
- **"Expired Assets"** — `MediaAsset` has no expiry-date field this checkpoint (unlike `Document.expires_at`). Detecting "expired" would require adding that field, which wasn't part of any step in this spec.

Both are surfaced honestly rather than silently dropped, so a caller (or a future checkpoint) knows they were considered and explicitly deferred, not forgotten.

## Where it's used

`modules/knowledgeGraph/knowledgeGraphActions.ts`'s `getKnowledgeHealthAction()` builds the `nodesToValidate` list from every relationship's source/target endpoints, plus `existingNodeKeys` from every Media Asset's owner. The Relationship Explorer's "Knowledge Health" card renders orphans, broken relationships, and duplicate/circular group counts.

## Tests

`core/knowledge/knowledgeHealthEngine.test.ts` — 7 cases: broken-relationship detection (including the active-only filter), acyclic vs. cyclic hierarchical chains, non-hierarchical types correctly ignored even when they mesh circularly, and the full composed report.
