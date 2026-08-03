# Relationship / Graph Explorer

v2.0 Checkpoint 25, Step 10.9. `/assets/knowledge-graph` (`modules/knowledgeGraph/components/KnowledgeGraphExplorerView.tsx`), linked from the Asset Library's own header. Gated by `assets.view` — the same permission the Asset Library and Asset Intelligence already use (see `core/enums/permission.ts`'s own comment anticipating this).

Per the spec's explicit instruction — "Do not require an external graph visualization library if the existing design system can provide a clear, accessible relationship explorer" — this is entirely list/table-based, built from the same `Card`/`Badge`/`Button` primitives every other module page uses. No graph-rendering library was added.

## Sections

1. **Graph Statistics** — active/archived/rejected relationship counts and duplicate-group count, from `getGraphStatsAction()`.
2. **Node Inspector** — pick a node type + id, see:
   - Relationship / Connection / Dependency summaries (plain prose, `knowledgeGraphBrief.ts`)
   - Constraint Validation (severity-tagged list from `validateNodeConstraints`)
   - Direct Relationships (one-hop list, tagged with direction and, when present, the edge's semantic role)
3. **Path Explorer** — pick two nodes, see the shortest path between them (`findShortestPathAction`, BFS, capped at 5 hops) rendered as a breadcrumb chain, or "No path found."
4. **Knowledge Health** — orphaned assets, broken relationships, and duplicate/circular group counts (`getKnowledgeHealthAction()`, see `docs/knowledge-health.md`), only rendered when there's something to show.
5. **All Relationships** — a filterable table (by relationship type and status) over every relationship in the workspace, capped at 100 rows.

## What the spec asked for vs. what shipped

The spec lists Relationship Tree / Table / Dependency View / Impact View / Semantic View / Timeline View / Search / Filters / Graph Statistics / Path Explorer / Node Inspector as capabilities to support. All of them are present, but consolidated rather than built as ten separate screens:

- **Tree, Dependency, Impact, and Semantic views** all live inside the one Node Inspector panel (a node's direct relationships, its impact breakdown, and its semantic tags are all one contextual read, not four separate navigations).
- **Table + Search + Filters** are the "All Relationships" section (type/status dropdowns; a future free-text search over node ids is not yet built).
- **Timeline View** is not a dedicated panel in the Explorer itself — every graph mutation already flows into the Unified Communication Timeline (`docs/knowledge-graph.md`'s Timeline Integration section), so "timeline view of the graph" is the existing Timeline UI (Checkpoint 24), filtered to `knowledge_relationship_*` activity types, rather than a duplicate timeline rendered inside the Explorer.

## Known limitation

Node Inspector and Path Explorer require typing a raw node id (e.g. `event_1`) rather than picking a record from a searchable list — there's no CRM-record picker wired in yet. This is an honest power-tool interface for now, not a polished pick-a-client dropdown.

## Tests

Module-layer coverage is in `modules/knowledgeGraph/knowledgeGraphActions.test.ts` (15 cases) — the Explorer component itself is a thin data-fetching shell over those same actions and has no independent business logic of its own to unit test beyond what the actions already cover.
