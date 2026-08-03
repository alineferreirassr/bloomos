# Enterprise Knowledge Graph

v2.0 Checkpoint 25, Step 10.5, extended through Steps 10.6–10.9 and 12–15. The Knowledge Graph is BloomOS's single, generic relationship system — every entity (Client, Event, Invoice, MediaAsset, Proposal, Vendor, ...) can be connected to any other via one typed edge model. It is not a Media Asset feature: the DAM's own "Entity Relationships" (Checkpoint 25, Step 10) is a thin, asset-scoped view over this same graph, never a second parallel system — the explicit stop condition every step in this area was built against.

## Architecture

| Module | File | Role |
|---|---|---|
| Knowledge Graph types | `types/knowledgeGraph.ts` | `KnowledgeNodeType`, `RelationshipType` (29 named types), `RelationshipStatus`, `RelationshipSource`, `KnowledgeRelationship`, plus Step 10.6's `RelationshipSemantics` |
| Knowledge Node Registry | `KNOWLEDGE_NODE_TYPES` (same file) | Every `EntityType` plus a handful of graph-only node types (`media_folder`, `media_collection`, `comment`, `message`, `reminder`, `workflow`, `ai_insight`) |
| Knowledge Relationship Registry | `lib/data/core/knowledge/knowledgeGraphStore.ts` | The one mock store — `createRelationship`, `removeRelationship`, `approveRelationship`, `rejectRelationship`, `setRelationshipSemantics`, `listRelationshipsForWorkspace` |
| Relationship Engine | `core/knowledge/relationshipEngine.ts` | `wouldCreateRelationshipCycle`, `isValidRelationshipCandidate` |
| Graph Traversal Engine | `core/knowledge/graphTraversalEngine.ts` | `oneHop`, `multiHop`, `shortestPath`, `getRelationshipCounts`, `discoverRelatedNodes` — see "Performance" below |
| Dependency Engine / Impact Analysis Engine | `core/knowledge/impactAnalysisEngine.ts` | `computeImpactAnalysis`, `computeDetailedImpact` — see `docs/dependency-engine.md` |
| Orphan Detection Engine | `core/knowledge/orphanDetectionEngine.ts` | `detectOrphanedAssets`, `findDuplicateRelationships` |
| Graph Search Engine | `modules/knowledgeGraph/knowledgeGraphActions.ts` | Type/status filtering lives in the Explorer's own query — no dedicated search index was built; see `docs/graph-explorer.md`'s "what shipped" section |
| Knowledge Timeline Adapter | same actions file, `recordGraphTimelineEvent` | See "Timeline Integration" below |
| Knowledge Graph Repository | `core/knowledge/index.ts`'s `getCoreKnowledgeGraphService()` | Mock-only this phase, same `getCoreCommentsService()`/`getCoreTagsService()` precedent |

Two names from the spec's Step 10.5 architecture list are intentionally consolidated rather than built as separate files: **Relationship Constraints Engine** is documented on its own (`docs/relationship-constraints.md`) since Step 10.7 gave it real scope; **Knowledge Health Engine** likewise (`docs/knowledge-health.md`, Step 12).

## Steps 10.6–10.9

- **Step 10.6 — Semantic Relationship Engine**: `docs/semantic-relationship-engine.md`
- **Step 10.7 — Relationship Constraints Engine**: `docs/relationship-constraints.md`
- **Step 10.8 — Dependency & Impact Engine**: `docs/dependency-engine.md`, `docs/impact-analysis.md`
- **Step 10.9 — Relationship / Graph Explorer**: `docs/graph-explorer.md`

## Entity Relationships (DAM's own Step 10)

`lib/data/media/mockRepository.ts` records real graph edges as a byproduct of ordinary Media Asset operations, never a second relationship system:

- `uploadMediaAsset` → `belongs_to` edge from the asset to its owner entity.
- `setMediaAssetStatus("approved" | "rejected", ..., actorMemberId)` → `approved_by` / `rejected_by` edge from the asset to the approving team member (only recorded when a real `actorMemberId` is supplied — the display-name-only `actor` string alone can't identify a graph node).
- `addAssetToCollection` / `removeAssetFromCollection` → `included_in` edge from the asset to the collection, created/archived alongside the collection's own `asset_ids` array (which remains the source of truth for simple membership reads — the edge exists so Impact Analysis can answer "which collections include this asset" via traversal, not a second membership list).

See `lib/data/media/mediaKnowledgeGraphIntegration.test.ts` for the integration tests.

## Timeline Integration (Step 13)

Every graph mutation records a real `TimelineActivity`, via `recordGraphTimelineEvent()` in `modules/knowledgeGraph/knowledgeGraphActions.ts`:

- `knowledge_relationship_created`
- `knowledge_relationship_removed`
- `knowledge_relationship_semantics_updated`
- `knowledge_relationship_constraint_violated` (recorded when `createRelationshipAction` is blocked by a hard constraint violation — the attempted mutation itself is the auditable event, not just its success)

A relationship connects two nodes, but Timeline entries need a real `EntityType` owner. The recorder prefers the source node when it's Timeline-capable (a real `EntityType`, which now includes `media_folder`/`media_collection` alongside every CRM entity), falling back to the target, and is silently a no-op when neither side qualifies — a `comment` ↔ `workflow` relationship, for instance, has no Timeline entry, since neither is a Timeline-owning entity. This is a genuine, disclosed limitation, not a bug: those node types were added to the graph specifically because they *don't* need their own Comments/Notes/Timeline the way a Client or Event row does.

## Bloom AI Context Layer (Step 14)

`getBloomAiKnowledgeContextAction(node)` returns all seven named context types from the spec in one deterministic bundle — every field is a plain-template string over already-computed facts (`core/knowledge/knowledgeGraphBrief.ts`), never an LLM call, never a speculative relationship:

```ts
interface BloomAiKnowledgeContext {
  entityContext: string;      // connection + relationship summary combined
  assetContext: string;       // usage summary (meaningful for media_asset nodes; harmless elsewhere)
  relationshipContext: string;
  dependencyContext: string;
  semanticContext: string;    // business-meaning-tagged relationships, or an honest "none assigned yet"
  impactContext: string;      // prose rendering of computeDetailedImpact
  timelineContext: string;    // this node's own recent Timeline activity, when it owns one
}
```

No external AI provider is connected — this is exactly the "prepare the graph as a context source" groundwork the spec asked for, not a Skill invocation.

## Performance (Step 15)

`graphTraversalEngine.ts`'s `multiHop`/`shortestPath` used to call a linear-scan helper once *per node visited* — O(hops × edges) for a large graph. Both now build one adjacency index (`Map<nodeKey, edges[]>`, both directions) up front and walk it — O(edges + hops). The index is memoized per relationship-array reference in a `WeakMap`: since the store never mutates an array in place (every mutation reassigns a new one, the established "immutable reassignment" convention across this codebase), the same array reference reappearing across calls within one request is a genuine cache hit, with no separate invalidation logic required — a stale array is simply never looked up again.

Circular-reference protection (a `visited` set) and a hard `maxDepth` cap (default 5) were already structural from Step 10.5 and prevent recursive explosions in both the traversal engine and `relationshipEngine.wouldCreateRelationshipCycle`.

## Permissions

Gated by `assets.view` (read: Explorer, Asset Intelligence's Knowledge sections) and `assets.manage` (create/remove relationships, edit semantics) — the same permission pair Checkpoint 25's own DAM work introduced, reused rather than adding a new `knowledge_graph.*` permission (see `core/enums/permission.ts`'s own comment anticipating this).

## Known limitations

- No dedicated free-text search over node ids in the Explorer yet — filtering is by relationship type and status only (`docs/graph-explorer.md`).
- Node Inspector / Path Explorer require typing a raw node id rather than picking from a searchable record list.
- "Unused Templates" and "Expired Assets" (Knowledge Health, Step 12) are out of scope this checkpoint — see `docs/knowledge-health.md`.
- No live browser verification was possible in this session (no Supabase login credentials available in this environment) — verified instead via the full automated test suite (`tsc`, `eslint`, `vitest`, production build), all passing.

## Tests

`core/knowledge/*.test.ts` (knowledgeGraphStore, relationshipEngine, graphTraversalEngine, impactAnalysisEngine, orphanDetectionEngine, relationshipConstraintsEngine, knowledgeHealthEngine, knowledgeGraphBrief) plus `modules/knowledgeGraph/knowledgeGraphActions.test.ts` and `lib/data/media/mediaKnowledgeGraphIntegration.test.ts` — pure-engine unit tests plus module-layer integration tests, matching this codebase's established two-tier testing convention.
