# Owner Dashboard

Checkpoint 19, Step 6. Rendered at `/dashboard` for role `owner`/`admin` (see `docs/dashboard-experience-resolver.md`). Matches the approved Owner reference image's own structure exactly.

## Data source

`getOwnerDashboardData()` (`src/modules/dashboard/luxury/getOwnerDashboardData.ts`, a `"use server"` aggregator) composes only existing services — never a second, parallel calculation of anything Finance/CRM/Analytics already computes:

| Section | Real data source |
|---|---|
| Revenue This Month | `computeWorkspaceFinancialSummary()` (`modules/finance/financialSummary.ts`, Checkpoint 8) |
| Upcoming Events | `getEvents()`, filtered to active + future-dated |
| New Leads | `getLeads()`, filtered by status + `created_at` |
| Proposals Pending | `getProposalsRepository().getRecentProposals()`, filtered to `status === "draft"` |
| Outstanding Payments | `computeWorkspaceFinancialSummary().outstanding_receivables_minor` + a real invoice count |
| Upcoming Events list / Calendar — This Week | `getEvents()`, grouped by day for the next 7 days |
| My Priorities | `getChecklistByEventId()` across every active event, filtered to open + `critical`/`high` priority |
| Revenue Overview | 6 real months of `Invoice.total_minor`, grouped by `issue_date`'s month — a genuine computed series, never a fabricated shape (see `RevenueTrendChart` in `docs/luxury-design-system.md`) |
| Recent Messages | `listClientPortalThreadsForWorkspace()` + `listClientPortalMessages()` (Checkpoint 16's own workspace-wide message listing, previously unused by any UI) — the **only** messaging system this codebase has, viewed from the staff side; a thread whose latest message is client-authored is flagged as awaiting reply |
| Team Activity | Recently-completed `ChecklistItem`s across the workspace, attributed to `assigned_name` — a real, derived proxy for "team activity," since no dedicated internal activity/audit feed exists |
| AI Executive Brief | `generateDailyOperationsBrief()` (Checkpoint 5's own Daily Operations Brief pipeline) — see below |

## AI Executive Brief

Reuses the exact same Server Action the now-retired Classical Dashboard's `DailyBriefCard` called — no second AI summarizer. Generation only happens on a real click (`OwnerAIBriefCard`'s "Generate brief" button), never on page load: the Daily Brief's own execution history persists metadata only, never the generated text (`types/dailyBriefExecution.ts`), so there is nothing to passively read on mount. `OwnerAIBriefCard` also took over `DailyBriefCard`'s own Bloom AI Skill Picker runner registration (`registerSkillRunner(DAILY_OPERATIONS_BRIEF_SKILL_ID, ...)`), so "Daily Operations Brief" stays reachable from the global Skill Picker/Command Palette now that this card is the only surface that renders it.

## Permissions (Step 17)

`getOwnerDashboardData()` rejects any session that isn't `kind: "active"`, and rejects any role that doesn't resolve to `"owner"` via `resolveDashboardExperience()` — server-side, before any data is computed. This is re-checked independently of the page-level routing branch in `/dashboard/page.tsx`.

## Known limitations

- **"Calendar — This Week" is a 7-day agenda list**, not an hour-by-hour grid calendar (see `docs/luxury-design-system.md`).
- **Team Activity is derived from checklist completions**, not a dedicated activity/audit log — this codebase has none. It's a genuine, real signal (who completed what, when), just not an exhaustive activity feed.
- **The sidebar's flat nav list omits a few destinations the reference image names but that have no real route** (Calendar, Tasks, Gallery, Reports as their own pages) — see `docs/luxury-design-system.md`.
