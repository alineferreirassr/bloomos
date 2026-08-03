# Search Health

v2.0 Checkpoint 40 — Global Search & Universal Command Center. `core/search/searchHealthEngine.ts`'s `computeSearchHealth(evaluatedAt)` — the same category-score composite pattern `core/knowledge/businessHealthEngine.ts` already established, applied to Search itself: three named categories, honestly `notApplicable` where nothing real can be measured yet.

## Categories

| Category | How it's scored |
|---|---|
| `coverage` | `100 - 3 × (uncovered entity types)`, clamped 0–100. Uncovered = every real `EntityType` (`core/enums/entityType.ts`) not registered via `registerSearchableEntity()` (`core/search/registry.ts`). Reuses the registry directly — never a second coverage calculation. |
| `index` | `100` when a real `SearchProvider` is active (`getActiveSearchProvider() !== nullSearchProvider`), `0` otherwise — every search silently returns `[]` with the null provider. |
| `performance` | Always `notApplicable`, score `null`. Nothing timed a search before this checkpoint — `SearchHistoryEntry` has no duration field — so a performance score here would be fabricated. Disclosed honestly, matching `businessHealthEngine.ts`'s own discipline for `communication_health`. |

`overallScore` averages only the categories with a real score (never counts `performance`'s `null` against the average).

## Recommendations

`computeSearchHealth()` generates plain-language recommendations only from real gaps it just detected:

- If any entity types are uncovered: names the first three and points at registering them.
- If the index score is `0`: points at `setActiveSearchProvider()`.

Both strings are derived from the same data the categories themselves computed — never a separate recommendation model.

## Wired into Business Health

`types/businessHealth.ts`'s `HEALTH_CATEGORIES` gained `search_health`, following the exact `workflow_readiness` precedent Checkpoint 39 established: optional input, `notApplicable` until supplied, so every pre-Checkpoint-40 caller of `computeBusinessHealth()` keeps compiling unchanged.

`core/knowledge/businessHealthEngine.ts`'s `ComputeBusinessHealthInput` gained `searchHealth?: SearchHealthReport | null`. When supplied, the `search_health` category score is `searchHealth.overallScore` and its issues are every category's own `issues`, flattened — never recomputed. `modules/knowledgeGraph/businessHealthActions.ts` computes it via `computeSearchHealth(now)` and passes it straight through, mirroring exactly how `workflowHealth` was wired in Checkpoint 39.

## Wired into Executive Decisions

`core/search/executiveIntegration.ts`'s `searchHealthToRecommendations(report, workspaceId)` translates every category issue into the exact `OperationalRecommendation` shape every other platform already feeds `executiveDecisionEngine.ts` with — `nodeType: "workspace"` throughout, since Search Health is workspace-wide, never per-entity (the same precedent `core/digitalAssets/executiveIntegration.ts` and `core/scheduling/schedulingFindingsEngine.ts` already established). Severity maps by score: `<50` critical, `<80` warning, otherwise info; a `null` score maps to info.

`modules/search/searchActions.ts`'s `searchRecommendationsForExecutiveDecisions()` follows the exact `xRecommendationsForExecutiveDecisions()` naming convention every other platform uses (`workflowRecommendationsForExecutiveDecisions`, `routeOptimizationRecommendationsForExecutiveDecisions`, etc.) — returns the bare `OperationalRecommendation[]`, never a full `RecommendationSource`, since `executiveDecisionsActions.ts`'s own `Promise.all` + `recommendationSources` array wraps every source itself the same way. Self-contained: returns `[]` for an inactive session, never throws.
