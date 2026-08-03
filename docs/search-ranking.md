# Search Ranking

v2.0 Checkpoint 40 — Global Search & Universal Command Center. How a result's raw provider score becomes its final position in the list, and how filters remove results before that ordering happens.

## Boosts

`core/search/rankingEngine.ts` applies two boosts as a separate pass layered on top of `rankSearchResults()` (`pipeline.ts`), never inside it. A `SearchProvider` only ever sees `SearchQuery` (workspace + term + filters) — it has no business reading one member's own Favorites/Recent Items, which live in `modules/workspace`'s own tables. Keeping the boost a distinct post-processing step keeps `core/search` fully decoupled from per-member Workspace state.

| Boost | Amount | Applies when |
|---|---|---|
| `RECENCY_BOOST` | +15 | The result's `{entityType}:{entityId}` key is in the member's own recently-viewed items |
| `FAVORITE_BOOST` | +25 | The result's key is in the member's own favorites |

Both stack (a favorited-and-recently-viewed result gets +40). `applyRankingBoosts()` never mutates its input, and treats an unscored result (a provider that never scored it) as score 0 before boosting — so an unscored-but-favorited result still outranks an unscored-and-unfavorited one, without silently becoming a false "exact match."

`buildResultKey(entityType, entityId)` is the one canonical key builder every caller (ranking, `searchAction()`'s favorite/recent lookups, `CommandCenterView`'s Universal Navigation lists) uses — never a second key format.

## Filters

`core/search/filterEngine.ts`'s `applySearchResultFilters(results, filters?)` is pure, no I/O — every field it filters on is one `SearchResult` already carries, or doesn't, in which case that filter simply excludes the result rather than guessing:

| Filter | Behavior |
|---|---|
| `entityTypes` | Keep only matching entity types |
| `statuses` | Keep only results whose `status` is in the list (excludes a result with no `status` at all) |
| `owners` | Same, against `owner` |
| `tags` | Keep results with at least one matching tag |
| `archived` | Exact boolean match against `archived` (missing = `false`) |
| `minHealth` | Keep results with `health >= minHealth` (excludes a result with no `health`) |
| `updatedAfter` / `updatedBefore` | Inclusive ISO 8601 bounds against `lastUpdatedAt` |

Filtering happens **before** the rank+limit slice in `runSearch()` — see `docs/search-engine.md`'s Pipeline section for why order matters here.

## Where boosts get applied

`searchAction()` (`modules/search/searchActions.ts`) is the only caller that applies ranking boosts — it fetches the signed-in member's own favorites and recent items, builds the two key sets, calls `applyRankingBoosts()`, then re-sorts by the boosted score. The raw `runSearch()` pipeline (used by e.g. the Workspace Home's `GlobalSearchWidget`) never applies member-specific boosts on its own — that's a deliberate composition point, not every caller re-implementing the same boost logic.
