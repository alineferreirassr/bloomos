# Search Engine

v2.0 Checkpoint 40 — Global Search & Universal Command Center. The engine layer underneath `docs/global-search.md`'s own provider: what makes a term into ranked, filtered `SearchResult[]`, decoupled into three separate, composable passes so none of them needs to know about the others.

## Pipeline

`core/search/pipeline.ts`'s `runSearch(query)` is still the one entry point every caller uses — unchanged in shape since Checkpoint 38, but its own body now composes three passes in a fixed order:

1. **Provider execution** — `getActiveSearchProvider().search(query)` (`workspaceSearchProvider.ts`, `docs/global-search.md`) fetches and scores raw candidates.
2. **Filter** — `applySearchResultFilters(results, query.filters)` (`core/search/filterEngine.ts`) removes anything that doesn't match `SearchResultFilters`.
3. **Rank + limit** — `rankSearchResults()` sorts by score and slices to `query.limit`.

Filter runs **before** rank+limit, not after. Filtering after the limit slice would silently under-fill a result set — a filtered-out item might have taken a slot a real match should have had. `runSearch()`'s own doc comment states this explicitly.

## Fuzzy matching

`core/search/fuzzyMatch.ts` generalizes the three-tier scoring convention `workspaceSearchProvider.ts` and `core/settings/search.ts` already used (exact > prefix > substring) into five tiers:

| Tier | Score | Matches |
|---|---|---|
| `exact` | 100 | Full title equals the term |
| `prefix` | 90 | Title starts with the term |
| `wordPrefix` | 80 | Any individual word in the title starts with the term (so "Amoré client" is found by typing "client") |
| `substring` | 70 | Term appears anywhere in the title |
| `fuzzy` | 50 | Typo-tolerant match via Levenshtein distance — 1 edit for terms ≤4 characters, 2 edits otherwise |

`scoreMatch(term, title)` is the one entry point; it returns `{tier: "none", score: 0}` rather than `null` for a non-match, matching this codebase's "never return a bare null where a discriminated shape reads clearer" convention. `levenshteinDistance()` and `isFuzzyMatch()` are exported separately for callers that only need the typo-tolerance check.

## Entity registration (now 21 types)

`core/search/defaultRegistrations.ts` grew from 9 to 21 registered `SearchableEntityConfig` entries. The 12 new ones this checkpoint added, each with a route already confirmed live in the route catalog before registration (never a placeholder link):

| Entity type | Module | Route |
|---|---|---|
| `proposal` | CRM | `/proposals/:id` |
| `workflow` | Automation | `/workflows/:id` |
| `decision` | Executive | `/assets/executive-decisions` (dashboard, no per-item detail page) |
| `objective` | Executive | `/assets/business-health` (dashboard, no per-item detail page) |
| `dispatch_order` | Operations | `/dispatch/:id` |
| `route_plan` | Operations | `/route-optimization/:id` |
| `operational_plan` | Operations | `/operational-planning/plans/:id` |
| `execution_package` | Operations | `/execution-packages/:id` |
| `resource_bundle` | Operations | `/allocations/bundles` (dashboard, no per-item detail page) |

`workflow_template` was deliberately excluded — no standalone detail page exists for it.

## EntityType extension and its one side effect

`core/enums/entityType.ts`'s `ENTITY_TYPES` gained the 8 new values above (`workflow` through `resource_bundle`) so Notes/Timeline/Comments/Search/Audit ownership references type-check against them. None of the 8 ever gained real Timeline recording — Decision/Objective Timeline events record against their own *related entity*, never against `"decision"`/`"objective"` themselves (`recordDecisionTimelineEvent` in `executiveDecisionsActions.ts`).

Adding them to `ENTITY_TYPES` had one real side effect: `modules/knowledgeGraph/knowledgeGraphActions.ts`'s `recordGraphTimelineEvent()` used the *entire* `ENTITY_TYPES` set as a "is this Timeline-capable" proxy. Since `workflow` (a pre-existing example of an intentionally non-Timeline-capable node type, alongside Comment and AI Insight) became a real `EntityType`, that proxy check silently started treating it as Timeline-capable. Fixed with a `NON_TIMELINE_CAPABLE_ENTITY_TYPES` exclusion set and an `isTimelineCapableEntityType()` helper, restoring the exact pre-Checkpoint-40 behavior — confirmed via repo-wide grep that none of the 8 new types is ever passed as `recordTimelineActivity()`'s own `ownerType`.

## Candidate fetchers (21, up from 9)

`workspaceSearchProvider.ts`'s `CANDIDATE_FETCHERS` map grew to match the 21 registered entity types. New fetchers for entities without their own `getX()` list function reuse the exact repository/core-service functions every other page in that module already calls (`getCoreDecisionsService()`, `getCoreObjectivesService()`, `getCoreDispatchOrdersService()`, `getCoreRouteOptimizationService()`, `getCoreOperationalPlansService()`, `getCoreExecutionPackagesService()`, `getCoreResourceBundlesService()`, `getWorkflowManager()`, `getProposalsRepository()`) — never a second query path.

Two entity types have no title field of their own (`DispatchOrder`, `RoutePlan`); their search result titles are synthetic-but-honest, built from real fields (`"Dispatch Order — {status}"`), not fabricated.

`searchProposals()` specifically calls `getProposalsRepository().getRecentProposals(workspaceId, 500)` directly from `@/lib/data/proposals` — not the `"use server"` `listProposalSummariesAction()` — since a plain `core/` module importing a Server Action pulls in `resolveMemberSessionSnapshot()`'s server-only Supabase chain, breaking any test or client component that imports this file.

## Preview fields

`SearchResult` gained optional `icon`, `status`, `owner`, `tags`, `lastUpdatedAt`, `health`, `archived` — every field additive, so every pre-existing caller keeps compiling. A provider that doesn't populate a given field for a given entity type simply means the UI can't show/filter on it for that type yet — never a fabricated value standing in for one the provider didn't honestly have.
