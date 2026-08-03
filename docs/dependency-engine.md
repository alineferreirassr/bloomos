# Dependency & Impact Engine

v2.0 Checkpoint 25, Step 10.8. Before any destructive operation (delete/replace/archive/move), BloomOS should answer: what depends on this, and what would break? This extends the existing `core/knowledge/impactAnalysisEngine.ts` (Step 10.5's `computeImpactAnalysis`) — it does not duplicate it.

## `computeImpactAnalysis` (Step 10.5, unchanged)

Groups every inbound relationship (everything pointing *at* a node) by node type, plus three boolean flags (`hasActiveEventDependents`, `hasApprovalDependents`, `hasAutomationOrWorkflowDependents`) and `isSafeToDelete` (true when `totalDependents === 0`).

## `computeDetailedImpact` (Step 10.8, new)

Reuses `computeImpactAnalysis`'s own grouping — never re-walks the relationship array a second time — and maps it onto the spec's named categories:

```ts
interface DetailedImpactBreakdown {
  base: ImpactAnalysisResult;
  affectedAssets: DependencyItem[];
  affectedClients: DependencyItem[];
  affectedEvents: DependencyItem[];
  affectedDocuments: DependencyItem[];
  affectedWorkflows: DependencyItem[];
  affectedAutomations: DependencyItem[];
  affectedCollections: DependencyItem[];
  affectedTimelineEntries: DependencyItem[];
  affectedAiContext: DependencyItem[];
}
```

Two categories have no dedicated `KnowledgeNodeType` bucket of their own, so they're derived from existing Step 10.5 infrastructure rather than invented as new concepts:

- **Affected Timeline Entries** — every inbound relationship whose `relationship_type` is `appears_in_timeline` (already one of the 29 named relationship types), regardless of the source node's own type.
- **Affected AI Context** — every dependent whose node type is `ai_insight` (already one of the extra `KNOWLEDGE_NODE_TYPES` beyond `EntityType`, reserved since Step 10.5 for exactly this).

## Where it's used

- `modules/knowledgeGraph/knowledgeGraphActions.ts`'s `getNodeRelationshipsAction()` returns `impact: computeDetailedImpact(...)` for the Asset Intelligence page's Impact Analysis section.
- `core/knowledge/knowledgeGraphBrief.ts`'s `generateImpactContext()` renders the same breakdown as prose for Bloom AI (`docs/knowledge-graph.md`).
- The Relationship Explorer's Node Inspector shows only the non-zero categories, so a node with no timeline/AI-context dependents doesn't render two empty rows.

## Tests

`core/knowledge/impactAnalysisEngine.test.ts` covers `computeDetailedImpact` bucketing all nine categories from a mixed set of inbound edges, and the empty-dependents case where every category is `[]` and `base.isSafeToDelete` is `true`.
