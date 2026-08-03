# Search Analytics

v2.0 Checkpoint 40 — Global Search & Universal Command Center. `core/search/searchAnalyticsEngine.ts`'s `computeSearchAnalytics(history, recentItems, favorites, commandUsage, evaluatedAt)` — pure computation over already-fetched lists, no I/O, no new tracking store beyond the two this checkpoint's own Steps 5 introduced.

## Two new stores, deliberately separate

| Store | Tracks |
|---|---|
| `SearchHistoryEntry` (`types/globalSearch.ts`) | Every raw query a member actually typed — term, matched entity types, result count, timestamp |
| `WorkspaceRecentItem` (Checkpoint 38, extended) | Entities actually opened — separate from history since a zero-result search is still worth recording for analytics even though it opened nothing |

`SearchHistoryEntry` never merges into `WorkspaceRecentItem` — "searches run" and "entities opened" are different signals, and Search Analytics needs both without conflating them.

## Metrics

| Field | Computed from |
|---|---|
| `totalSearches` | `history.length` |
| `mostSearchedTerms` | Case-insensitive term frequency, top 10 |
| `mostSearchedEntityTypes` | Frequency of each `entityTypes` entry across history, top 10 |
| `mostSearchedCommands` | `getCommandUsage()` (`core/commandPalette/commandUsageStore.ts`) passed straight through, top 10 |
| `noResultSearches` | Every history entry with `resultCount === 0` |
| `noResultRate` / `successRate` | 0–1 fractions — `noResultRate = noResultCount / totalSearches`, `successRate = 1 - noResultRate` (both `0` when there's no history yet) |
| `averageResultCount` | `totalResultCount / totalSearches` |
| `mostOpenedResult` | The `WorkspaceRecentItem` with the highest `visit_count` |
| `mostPinnedResult` | The first `WorkspaceFavorite` with `pinned: true` |

**Deliberately excluded: "average search time."** Nothing in `runSearch()` timed a search before this checkpoint — `SearchHistoryEntry` carries no duration field — so fabricating one would violate this codebase's own "never invent a value the data doesn't honestly support" discipline. A future checkpoint that wants it should add a real `durationMs` field first, the same way `visit_count` was added to `WorkspaceRecentItem` here.

## Command usage tracking

`core/commandPalette/commandUsageStore.ts` is a genuinely new, minimal in-memory invocation counter — the only way "most searched commands" could be real rather than fabricated, since nothing tracked command usage before this checkpoint. `recordCommandInvocation(commandId)` is called from `CommandPalette.tsx`'s own command `onClick` handler; `getCommandUsage()` returns every counted command sorted by count descending.

## Where it's surfaced

`getSearchAnalyticsAction()` (`modules/search/searchActions.ts`) gates on `workspace.manage` — the same elevated permission every workspace-wide analytics surface in this codebase already requires — and feeds `/search/analytics` (`SearchAnalyticsView`). It reads this member's own workspace-scoped `SearchHistoryEntry[]`, `WorkspaceRecentItem[]`, and `WorkspaceFavorite[]`, plus the shared `commandUsageStore`.
