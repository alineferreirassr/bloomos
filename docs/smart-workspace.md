# Smart Workspace Platform

## What this is

v2.0 Checkpoint 38's own stop condition is explicit: "this checkpoint is NOT about creating new business modules... connect, orchestrate, and surface everything that already exists." The Smart Workspace Platform is a new unified home (`/workspace`) that composes twelve widgets, each a thin presentation layer over an already-real platform action. Nothing in this checkpoint duplicates a Timeline, a Search Engine, a Notification system, a Knowledge Graph, an Executive Dashboard, a Business Health engine, or an Operational Intelligence engine — every one of those already existed and is reused as-is.

## What's genuinely new vs. reused

| Concept | Status | Where |
|---|---|---|
| Widget layout (pin/hide/reorder) | New | `types/smartWorkspace.ts`, `core/workspace/widgetRegistry.ts`, `lib/data/mock/workspaceLayoutStore.ts` |
| Cross-entity Favorites | New (Digital Assets had its own scoped version; this generalizes the concept) | `core/workspace/favoritesEngine.ts`, `lib/data/mock/workspaceFavoritesStore.ts` |
| Cross-entity Recent Items | New | `core/workspace/recentItemsEngine.ts`, `lib/data/mock/workspaceRecentItemsStore.ts` |
| Quick Actions | New (a static registry of links into real creation flows) | `core/workspace/quickActionsRegistry.ts` |
| Workspace Health composite | New aggregation, zero new scoring logic | `core/workspace/workspaceHealthEngine.ts` |
| Global Search | New `SearchProvider` implementation, filling an architecture shell that existed but was never wired | `core/workspace/workspaceSearchProvider.ts` |
| Activity Feed digest | New summarization, zero new fetch | `core/workspace/activityFeedEngine.ts` |
| Recommendations | Pure top-N selection over the real Executive Decisions queue | `core/workspace/recommendationsEngine.ts` |
| Knowledge Graph Explorer | Reused as-is, linked to | `/assets/knowledge-graph` (Checkpoint 25 continuation) |
| Executive/Business/Operational/Analytics Overview | Reused actions, new compact widget presentation | See table below |

## The twelve widgets and what each one reuses

| Widget | Real source | Never duplicates |
|---|---|---|
| Executive Overview | `generateExecutiveBrief()` (Checkpoint 20) | A new AI summarizer — this is the same deterministic, template-based brief the Owner Dashboard already used |
| Business Overview | `WorkspaceHealthSummary.platforms`, filtered to proposals/contracts/invoices/journeys/capability/assets | A second health scoring pass |
| Operational Overview | `evaluateOperationsCenterAction()`'s own `overallOperationsCenterHealth` (Checkpoint 31) | The Operations Center's own 10-platform composite — reused whole, not re-derived |
| Analytics Overview | `getExecutiveDashboardData()` (Checkpoint 23) | Executive Analytics & BI's own KPI computation |
| Activity Feed | `getActivityFeedData()` → `aggregateActivity()` (Checkpoint 24), reading the real Timeline store | A second Timeline or event system |
| Global Search | `runSearch()` (`core/search/pipeline.ts`) via the new `workspaceSearchProvider` | A second search index — this fills in the one that already existed as an unwired shell |
| Favorites | The new cross-entity favorites store | — |
| Recent Items | The new cross-entity recent-items store | — |
| Quick Actions | Static links into real, already-built creation routes | New business logic for any creation flow |
| Workspace Health | `aggregateWorkspaceHealth()`, composing 7 platform-level scores | Any individual platform's own Health Engine formula |
| Knowledge Graph | `getGraphStatsAction()` (Checkpoint 25 continuation), linking to the real Explorer page | A second graph model or traversal engine |
| Recommendations | The top of `evaluateExecutiveDecisionsAction()`'s own `queue: Decision[]` | A second recommendation pipeline — Executive Decisions already composes ~19 platforms' own recommendation sources |

## A real, pre-existing bug this checkpoint fixed

`core/search/types.ts` defined a full `SearchProvider`/`SearchQuery`/`SearchResult` architecture and `core/search/pipeline.ts`'s `runSearch()` was already being called by two real, shipped UI surfaces — the Command Palette's search box (`CommandPalette.tsx`) and Bloom AI's Copilot panel search (`CopilotPanel.tsx`). But `setActiveSearchProvider()` was never called anywhere in the codebase (confirmed via repo-wide grep before writing any code), so both of those search boxes were silently returning zero results in the running app. Registering `workspaceSearchProvider` in `core/initializeCore.ts` doesn't just power the new Workspace Global Search widget — it makes those two pre-existing search boxes work for the first time.

Separately, `core/search/defaultRegistrations.ts` never registered a `contract` entity even though `/contracts/[id]` has existed since Checkpoint 34 — added here alongside `media_asset` and `team_member`.

## Command Palette: mounted for the first time

`src/components/ui/CommandPalette.tsx` has existed since v2.0 Checkpoint 1 but had zero production imports — confirmed via repo-wide search before this checkpoint. It's now mounted once in `src/app/(app)/layout.tsx`, giving every authenticated page in BloomOS a working `mod+k`, not just the new Workspace Home. `registerDefaultWorkspaceCommands()` (`modules/workspace/registerWorkspaceCommands.ts`) adds six Workspace-scoped navigation commands, following the exact idempotent-registration pattern `registerDefaultCopilotCommands`/`registerCommunicationCommands` already established.

## Workspace Health, precisely

`core/workspace/workspaceHealthEngine.ts` composes seven platform-level scores into one overall figure:

1. **Operational** — `evaluateOperationsCenterAction()`'s own composite, itself already folding in Dispatch, Field Operations, Route Optimization, Scheduling, Resource Allocation, Execution Packages, Workforce, Business Health, Knowledge, and Objectives (10 platforms in one reused number).
2. **Digital Asset Health** — direct passthrough of `evaluatePlatformAction()`'s own `PlatformHealthSummary`.
3. **Proposal / Contract / Invoice / Client Journey Health** — each platform has no workspace-wide health action, only a per-entity one; the existing zero-param `list*SummariesAction()` already carries a per-entity `overallHealthScore`/`overallHealth`, averaged here.
4. **Workforce Capability Health** — a disclosed proxy (`isProxy: true`), since Capability Coverage exposes no native score, only `uncoveredRequirementIds`/`highRiskGapsCount`. Normalized the same way `operationsCenterHealthEngine.ts` (Checkpoint 31) already normalizes Resource Allocation's own finding counts into a 0–100 figure — the same disclosed-proxy precedent, not a new pattern.

Bands use the 90/70/40 thresholds `healthEngine.ts` (Checkpoint 37, Digital Assets) already established.

## Session/permissions

Every `workspaceActions.ts` function follows the exact `resolveMemberSessionSnapshot()` + `session.permissions.includes(...)` pattern every prior checkpoint's actions layer uses. `workspace.view` (pre-existing) gates every read; a new `workspace.customize` permission gates layout/favorites writes — added to `core/enums/permission.ts` following the same "mock-only this phase, catalog entry ahead of its migration row" precedent every prior checkpoint's own permission additions established.

## Known limitations (disclosed, not hidden)

1. **Global Search covers 9 entity types** (lead, client, event, contract, invoice, document, media asset, team member, vendor) — proposals were deliberately excluded: neither the older `ProposalDraft` type nor the newer Proposal Platform's `ProposalSummary` carries a usable title field, so no honest search result title could be built. Documented rather than faked.
2. **Widget reordering is up/down, not drag-and-drop** — matches the `dashboardLayoutActions.ts` (Checkpoint 23) precedent exactly; a richer drag interaction is a UI enhancement, not a data-model change, and can be added later without touching `WorkspaceLayout`'s own shape.
3. **The Knowledge Graph widget shows stats and links out**, it doesn't render the graph inline — the real, interactive Relationship Explorer already exists at `/assets/knowledge-graph`; embedding its full force-directed view inside a grid cell would either duplicate that UI or cramp it unusably.
4. **No live authenticated browser verification against the real Supabase-backed session** — `NEXT_PUBLIC_DATA_MODE` was temporarily flipped to `mock` for local verification, then restored, and the dev server stopped once verification finished.
