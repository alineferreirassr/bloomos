# Command Center

v2.0 Checkpoint 40 — Global Search & Universal Command Center. Two surfaces, one shared registry — the overlay for speed, the full page for browsing and discoverability.

## Two surfaces, one registry

`core/commandPalette/registry.ts`'s `Map<string, CommandAction>` is the single source of every runnable command — both surfaces below read it, neither owns a second list.

| Surface | What it is | Route |
|---|---|---|
| `CommandPalette.tsx` overlay | The Cmd/Ctrl+K modal — search-first, keyboard-only | Mounted once in `(app)/layout.tsx`, opens on `mod+k` |
| `CommandCenterView` | A full-page, browsable version — every command grouped, filterable by typing, plus Universal Navigation | `/command-center` |

"Replace every isolated command palette with this single Universal Command Center" (the checkpoint's own words) — a repo-wide audit before this checkpoint found only the one pre-existing `CommandPalette.tsx`, mounted app-wide since Checkpoint 38 but never wired to the real, permission-aware search. The fix wasn't consolidating multiple palettes (there weren't any others); it was making this one palette's search half as real as its command half — see the "What changed in the overlay" section below.

## Registration

`core/commandPalette/navigationCommands.ts`'s `NAVIGATION_COMMANDS` — a plain data array of every major platform's own real route (~31 entries as of this checkpoint), each with a `href` already confirmed live in the route catalog. Deliberately data, not `CommandAction[]` directly: turning an `href` into a real `run()` needs a router, which only exists client-side.

`core/commandPalette/registerGlobalCommands(navigate)` bridges this data (plus `listWorkspaceQuickActions()` from Checkpoint 38's Smart Workspace) into real `CommandAction`s — `nav-`/`quick-` prefixed ids, its own namespace so a global command can never collide with a page-scoped one registered elsewhere. `GlobalCommandRegistrar.tsx`, mounted once alongside `<CommandPalette>` in `(app)/layout.tsx`, is the one place this runs, using `useRouter()` for the navigation.

Three entries this checkpoint added to `NAVIGATION_COMMANDS`: "Open Global Search" (`/search`), "Open Command Center" (`/command-center`), "Open Search Analytics" (`/search/analytics`).

## What changed in the overlay

`CommandPalette.tsx`'s search box previously called `runSearch()` directly — unfiltered by permissions, un-boosted, never recorded to history. It now calls `searchAction()` (`modules/search/searchActions.ts`), the same permission-filtered, ranked, boosted, history-recording entry point every other Search surface uses. Added alongside that fix:

- **Keyboard navigation** — Arrow Up/Down moves a roving `activeIndex` across the merged commands+results list; Enter runs the highlighted command or navigates to the highlighted result.
- **"View all results in Global Search"** — a footer link to `/search/results?q=…` once a query is non-empty, so the overlay's 8-result cap never dead-ends a search that needs the full page.

`CopilotLauncher.tsx`'s own `useKeyboardShortcut("mod+k", toggle)` was removed in the same pass — a pre-existing dual-binding bug where both the Command Palette and the Bloom AI Copilot launcher listened for the same shortcut; Cmd+K now unambiguously opens the Universal Command Center.

## Universal Navigation (`CommandCenterView` only)

Composed entirely from Checkpoint 38's own `getWorkspaceSummaryAction()` — never a second navigation index:

| Section | Source |
|---|---|
| Pinned | `favorites.filter(f => f.pinned)` |
| Favorites | `favorites.filter(f => !f.pinned)` |
| Recent Pages | `recentItems` sorted by `viewed_at` |
| Most Visited | `recentItems` sorted by `visit_count` |
| Recently Edited | `recentItems.filter(r => r.action === "edit")` |
| Suggested / Continue Working | `recommendations` (the Executive Decision queue, `topRecommendations()`) |
