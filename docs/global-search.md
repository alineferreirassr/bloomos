# Global Search

`core/workspace/workspaceSearchProvider.ts` — the real `SearchProvider` implementation `core/search/types.ts`'s own doc comment anticipated: "a real one... slots in later by implementing this same interface." Before this checkpoint, `getActiveSearchProvider()` always returned `nullSearchProvider` (confirmed via repo-wide grep — `setActiveSearchProvider` was never called), so `runSearch()` always returned `[]`.

## What it searches

Nine entity types, each backed by the same real repository list function every other page already calls — no second index, no fuzzy matching library:

| Entity type | Source | Route |
|---|---|---|
| `lead` | `getLeads()` | `/leads/:id` |
| `client` | `getClients()` | `/clients/:id` |
| `event` | `getEvents()` | `/events/:id` |
| `contract` | `getContracts()` | `/contracts/:id` |
| `invoice` | `getInvoices()` | `/finance/invoices/:id` |
| `document` | `getDocuments({})` | `/documents/:id` |
| `media_asset` | `listMediaAssetsForWorkspace()` | `/assets/:id` |
| `team_member` | `getWorkspaceMembers()` | `/team` |
| `vendor` | `getVendors()` | `/vendors/:id` |

`Proposal` is deliberately excluded — neither `ProposalDraft` (`types/proposal.ts`) nor `ProposalSummary` (`types/proposalPlatform.ts`) carries a title field, so no honest search result title could be built without fabricating one.

## Scoring

Same three-tier convention `core/settings/search.ts`'s own `scoreMatch` already established: exact title match scores 100, a prefix match scores 90, a substring match scores 70. A snippet-only match (the term appears in the subtitle but not the title) scores 20, so it still surfaces but ranks last. `core/search/pipeline.ts`'s `rankSearchResults()` — unchanged — sorts by that score.

## Registry gap fixed along the way

`core/search/defaultRegistrations.ts` registered eight entity types but never `contract`, despite `/contracts/[id]` existing since Checkpoint 34. Adding a real provider was the first thing to actually execute a search against the registry, which is what surfaced the gap. Fixed by adding `contract`, `media_asset`, and `team_member` registrations.

## Where it's wired

`core/initializeCore.ts` now calls `registerDefaultSearchableEntities()` and `setActiveSearchProvider(workspaceSearchProvider)` once, at the same place `registerDefaultTimelineActivityTypes()` already ran. This has a side effect beyond the new Workspace widget: the Command Palette's own search box and Bloom AI's Copilot panel search both already called `runSearch()` — both start returning real results the moment this line runs, with no changes to either file.

## Named functions

| Function | Purpose |
|---|---|
| `workspaceSearchProvider.search(query)` | The `SearchProvider` implementation — fans out to the 21 entity fetchers (see Checkpoint 40 below), filters, and scores |
| `searchWorkspaceAction(term, entityTypes?)` (module actions layer) | The Server Action the Workspace Home's `GlobalSearchWidget` calls, itself just calling `runSearch()` — unboosted, unfiltered by member-specific favorites/recents, a lightweight preview |
| `searchAction(term, entityTypes?, filters?)` (`modules/search/searchActions.ts`, Checkpoint 40) | The permission-filtered, ranked, boosted, history-recording entry point every real Search UI surface uses — see `docs/search-permissions.md` |

## v2.0 Checkpoint 40 — Global Search & Universal Command Center

This checkpoint turned the above into a full platform, without duplicating any of it. What changed:

- **21 registered entity types**, up from 9 — see `docs/search-engine.md` for the 12 new ones and their routes.
- **Fuzzy/typo-tolerant matching** — `core/search/fuzzyMatch.ts`, layered underneath the existing three-tier scoring (see `docs/search-engine.md`).
- **Ranking boosts + filters** — `core/search/rankingEngine.ts` / `filterEngine.ts`, applied as separate passes over an already-scored result set (see `docs/search-ranking.md`).
- **Permission filtering** — `searchAction()` filters every result through the same `canAccessRoute()` every route guard already uses (see `docs/search-permissions.md`).
- **Saved Searches + Search History** — two genuinely new stores (`SavedSearch`, `SearchHistoryEntry`), distinct from Checkpoint 38's `WorkspaceRecentItem` on purpose (see `docs/search-analytics.md`).
- **Search Health + Search Analytics** — `docs/search-health.md`, `docs/search-analytics.md`.
- **Universal Command Center** — the Cmd/Ctrl+K overlay's search half made permission-aware, plus a new full-page `/command-center` (see `docs/command-center.md`).
- **Four new UI surfaces**: `/search`, `/search/results`, `/search/analytics`, `/command-center` (see `docs/search-ui.md`).

Every one of these composes an already-real engine or store from an earlier checkpoint — see each linked doc's own "reuse map" for exactly what it calls instead of reimplementing.
