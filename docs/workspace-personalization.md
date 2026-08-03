# Workspace Personalization — Layout, Favorites, Recent Items, Quick Actions

The four genuinely new, non-composed pieces of state this checkpoint introduces. Everything else in the Smart Workspace Platform reads from an already-real platform action; these four are new because no cross-entity version of any of them existed before.

## Widget Layout

Mirrors `DashboardWidgetPreference`/`DashboardLayout` (`types/businessIntelligence.ts`, Checkpoint 23, Step 14) exactly — same shape (`widgetId`, `pinned`, `hidden`, `order`), same per-`(workspace, member)` scoping, a new instance of the same pattern rather than a shared store, matching how every platform in this codebase repeats an established pattern instead of centralizing it into one cross-platform table.

- **Store**: `lib/data/mock/workspaceLayoutStore.ts` — `getWorkspaceLayout`/`saveWorkspaceLayout`, keyed by `(workspace_id, member_id)`.
- **Engine**: `core/workspace/widgetRegistry.ts` — pure layout logic only: `defaultWorkspaceWidgets()`, `visibleWidgetsInOrder()` (pinned first, hidden dropped), `toggleWidgetHidden`/`toggleWidgetPinned`/`reorderWidget` (swaps `order` with the adjacent widget), `resetToDefaultWidgets()`.
- **Reordering is up/down, not drag-and-drop** — same precedent as `dashboardLayoutActions.ts`; a richer interaction is additive UI work, not a data-model change.

## Favorites

The first cross-entity favorites concept in BloomOS. Digital Assets already had its own scoped `AssetFavorite` (Checkpoint 37) keyed to `media_asset` only; `WorkspaceFavorite` generalizes the same shape to any `EntityType`.

- **Store**: `lib/data/mock/workspaceFavoritesStore.ts`.
- **Engine**: `core/workspace/favoritesEngine.ts` — pure list transforms (`isFavorited`, `findFavorite`, `removeFavoriteById`, `sortFavoritesByRecency`, `groupFavoritesByEntityType`); persistence lives in the module actions layer.
- **Toggle semantics**: `toggleFavoriteAction(entityType, entityId, label, href)` adds if absent, removes if present — one call handles both directions.

## Recent Items

- **Store**: `lib/data/mock/workspaceRecentItemsStore.ts`.
- **Engine**: `core/workspace/recentItemsEngine.ts` — `recordRecentItem()` de-dupes by `(entityType, entityId)` (moving an existing entry to the front with a fresh `viewed_at` rather than duplicating it) and caps the list at `MAX_RECENT_ITEMS` (20), oldest dropped first.
- **Recording is opt-in per page** — `recordRecentItemAction()` exists and is fully tested, but this checkpoint didn't retrofit every existing detail page to call it; that's additive wiring for a future pass, not a gap in the underlying mechanism.

## Quick Actions

`core/workspace/quickActionsRegistry.ts` — a static list of shortcuts into real, already-built creation flows. Never new business logic: every entry navigates to a route a prior checkpoint already shipped. Two entries (`new_proposal`, `upload_asset`) link to their module's own dashboard rather than a `/new` route, because neither Proposals nor Digital Assets has a standalone creation page — both create inline (a button/modal on the dashboard itself), confirmed by checking `src/app/(app)/proposals` and `src/app/(app)/assets` before writing the list.
