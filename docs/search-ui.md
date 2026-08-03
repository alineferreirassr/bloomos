# Search UI

v2.0 Checkpoint 40 — Global Search & Universal Command Center. The seven named views and four routes, all under `src/modules/search/components/` and `src/app/(app)/search|command-center`.

## Routes

| Route | Component | Gate |
|---|---|---|
| `/search` | `GlobalSearchView` | `active-membership` |
| `/search/results` | `SearchResultsView` | `active-membership` |
| `/search/analytics` | `SearchAnalyticsView` | `workspace.manage` |
| `/command-center` | `CommandCenterView` | `active-membership` |

## GlobalSearchView (`/search`)

The landing page: one large search input plus this member's own `RecentSearchesView` and `SavedSearchesView` side by side. Submitting always navigates to `/search/results?q=…` — this page never renders results itself, so there's exactly one place (`SearchResultsView`) that owns result/filter/preview state.

## SearchResultsView (`/search/results`)

The full results page. Reads the initial `q` from the URL (via the server `page.tsx`'s `searchParams`), then owns its own client-side state for term, entity-type filters, and the selected result. Every search goes through `searchAction()` — never `runSearch()` directly.

- **Entity-type filter chips** — built from `listSearchableEntityTypesAction()` (a thin action wrapping `core/search/registry.ts`'s own `getSearchableEntities()`, with the non-serializable `route` function dropped since a function can't cross the Server Action boundary), so the filter list is always exactly what the registry actually contains — never a second hardcoded list.
- **Results grouped by entity type**, each group a card, each row selectable.
- **`SearchPreviewPanel`** on the right (stacks below on narrow viewports) shows the selected result's full detail — every field conditionally rendered, since `SearchResult`'s preview fields (`status`, `owner`, `tags`, `lastUpdatedAt`, `health`) are optional per entity type.
- **Quick actions**: Open, Favorite/Unfavorite (`toggleFavoriteAction`), Pin/Unpin (`togglePinnedFavoriteAction`, only shown once a result is already favorited, matching that action's own precondition), Copy Link (`navigator.clipboard.writeText`).
- **Save Search** — prompts for a label (`window.prompt`, the same pattern `AssetDetailView.tsx`/`JourneyDetailView.tsx` already use), then `createSavedSearchAction(label, term, filters)`.

## SearchPreviewPanel (subcomponent)

Shared between `SearchResultsView` and, implicitly, anywhere a single `SearchResult` needs a detail card. Renders title, snippet, status/archived/health badges, owner, last-updated, tags, and the same quick actions listed above.

## RecentSearchesView / SavedSearchesView (subcomponents, used in `GlobalSearchView`)

Thin, focused list components — `RecentSearchesView` reads `getSearchHistoryAction()` and offers "Clear"; `SavedSearchesView` reads `listSavedSearchesAction()` and offers "Delete". Neither owns search-execution state; both just call the `onSelect` callback the parent passes in.

## SearchAnalyticsView (`/search/analytics`)

KPI cards (total searches, average results, success rate, no-result rate — the two rate fields converted from the engine's 0–1 fractions to percentages for display) plus four ranked lists (most searched terms/entity types/commands, no-result searches), most-opened/most-pinned result cards, and a Search Health panel (per-category score badges + recommendations). Every number is `getSearchAnalyticsAction()`'s / `getSearchHealthAction()`'s raw output — this view formats, it never recomputes.

## CommandCenterView (`/command-center`)

See `docs/command-center.md` for the full breakdown — commands grouped and filterable, plus the six-section Universal Navigation grid.

## Design system reuse

Every view composes existing shared primitives only — `PageHeader`, `Card`, `Badge`, `Button`, `TableSkeleton`, `ErrorState`, `EmptyState`, `Toast` — plus two new icons (`SearchIcon`, `CommandCenterIcon`) added to `components/ui/icons.tsx` following that file's own lucide-react wrapping pattern. No new design-system component was introduced; this checkpoint is entirely composition.
