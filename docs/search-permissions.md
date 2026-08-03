# Search Permissions

v2.0 Checkpoint 40 — Global Search & Universal Command Center. How "hidden entities must never appear in search" (the checkpoint spec's own words) is enforced, and why it needed no new permission-checking logic.

## The one filter

`searchAction()` (`modules/search/searchActions.ts`) is the single entry point the Global Search UI and Universal Command Center overlay both call — never `runSearch()` directly from a client component. After ranking, it filters every raw result through `core/permissions/routeAccess.ts`'s existing `canAccessRoute(result.route, can)`:

```ts
const visibleResults = rawResults.filter((result) => canAccessRoute(result.route, can));
```

This is the exact same route-guard function every page-level `RouteGuard` component and the Dashboard's own metric-card filtering already use — reused directly, never a second permission-checking layer. A result whose route requires a permission the signed-in member lacks is silently excluded before boosting, before history recording, before it ever reaches the UI.

## Route access entries added

`core/permissions/routeAccess.ts`'s `ROUTE_ACCESS_MAP` gained three entries:

| Prefix | Requirement |
|---|---|
| `/command-center` | `active-membership` — same as `/workspace`/`/dashboard`; every active member gets the Universal Command Center |
| `/search/analytics` | `permission: "workspace.manage"` — matches `getSearchAnalyticsAction()`'s own gate |
| `/search` | `active-membership` — every active member gets Global Search; longest-prefix matching resolves `/search/analytics` to the more specific entry above, `/search` and `/search/results` to this one |

No dedicated `RouteGuard`-wrapping `layout.tsx` was added for these routes — the same "route view, action-level manage" pattern `/assets` and other checkpoints already use: `getSearchAnalyticsAction()`/`getSearchHealthAction()` check `workspace.manage` themselves and return an error a member without it simply sees as an `ErrorState`, mirroring `/workspace`'s and `/dashboard`'s own precedent of relying on `(app)/layout.tsx`'s blanket active-session check rather than a per-module `RouteGuard`.

## What every action gates on

| Action | Gate |
|---|---|
| `searchAction`, `listSavedSearchesAction`, `createSavedSearchAction`, `deleteSavedSearchAction`, `getSearchHistoryAction`, `clearSearchHistoryAction` | Active session only — every result is still filtered per-result via `canAccessRoute()` |
| `getSearchAnalyticsAction`, `getSearchHealthAction` | Active session + `workspace.manage` — the same elevated gate every workspace-wide analytics/health surface in this codebase already requires |
| `listSearchableEntityTypesAction` | Active session only — pure metadata (label/module per entity type), nothing sensitive |

## No fabricated second index

The checkpoint's own instruction — "reuse the existing permission matrix, never bypass permissions" — is satisfied by construction: since every result already carries the real route the entity's own detail page lives at, and `canAccessRoute()` is the one function that already decides route access everywhere else in the app, Search never needs its own permission model. A module hidden from a member's navigation was already hidden from their route access; Search now respects that same boundary automatically.
