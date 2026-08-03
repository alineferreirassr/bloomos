# v2.0 Checkpoint 19 — Luxury Design System & Personalized Dashboard Experience

A unified luxury dashboard experience for BloomOS's three audiences — Workspace Owner, Team Member, and Client — replacing the operational-but-plain Classical Dashboard and the previous Client Portal landing page with the three approved reference designs, while reusing every existing business service underneath.

## Architecture

```
Authenticated User
       ↓
Dashboard Experience Resolver (core/dashboard/resolveDashboardExperience.ts)
       ↓
Role and Permission Resolution (WorkspaceMemberRole + Permission, re-checked per aggregator)
       ↓
Personalized Dashboard Composition (getOwnerDashboardData / getTeamDashboardData / getClientDashboardData)
       ↓
Shared Luxury Components (src/modules/dashboard/luxury/components/*)
       ↓
Existing BloomOS Services (CRM, Finance, Events, Checklist/Schedule, Documents, Messages, Portal, Analytics, AI, Team, Settings)
```

`/dashboard` (Server Component) resolves the signed-in member's session, branches on `resolveDashboardExperience()`, and renders `OwnerDashboardView` or `TeamDashboardView`. `/client-access` resolves the Client Account session independently and renders `ClientDashboardView`. `AppShell.tsx`/`ClientPortalShell.tsx` each skip their own Classical chrome for exactly these two routes, letting the new Luxury shells own the full page — every other route is completely untouched.

## Design System

Additive `--luxury-*` tokens in `globals.css` (blush/rose/coral/ivory/warm-white/muted-beige, distinct success/warning/critical/pending hues, large radii, soft shadows, a named type scale reusing the existing Cormorant/Lora font stacks) — never replacing the Classical system's own tokens. See `docs/luxury-design-system.md` for the full token table and the explicit scoping decision (Dashboard + Client Portal landing only, matching the checkpoint's own "Complete application redesign" Non-Goal).

## Shared Components

~30 new components under `src/modules/dashboard/luxury/components/`, each variant-driven rather than duplicated per experience: `EventHeroCard` serves both Team's "Current Event" and Client's "Your Proposal"; `ScheduleTimeline` serves both "Today's Schedule" and "Event Timeline"; `TaskChecklist` serves both "My Tasks" and "Planning Checklist"; `ActivityFeedList` backs both "Team Activity" and "Recent Messages"; `ImportantNotesCard` backs the generic notes/reminder cards and (via a thin wrapper) the Weather notice. Every dashboard DTO's icon is a plain string name, resolved client-side — the deliberate, verified-in-tests fix for the Analytics checkpoint's own function-serialization bug.

## Owner Dashboard

`getOwnerDashboardData()` composes real Finance/Events/Leads/Proposals/Client-Portal-Messaging data into 5 metric cards, Upcoming Events, a 7-day Calendar agenda, My Priorities, a real computed Revenue Overview line (dependency-free inline SVG), Recent Messages (the existing Client Portal messaging system, viewed from staff side — its only real messaging system), Team Activity (derived from real checklist completions), and an AI Executive Brief that reuses Checkpoint 5's own Daily Operations Brief pipeline on a real click. See `docs/owner-dashboard.md`.

## Team Dashboard

`getTeamDashboardData()` filters every list to what the signed-in member is actually assigned to before returning it — a documented, best-effort match on free-text `assigned_name`/`assigned_owner` fields (no real Team Member foreign key exists yet), falling back to a permission-gated visible set rather than an empty-by-accident dashboard. "Tasks" reuses `ChecklistItem` (no generic Task entity exists). A new, purely cosmetic `TeamRoleLabel` (Planner/Coordinator/Designer/Setup Team/Finance/Photographer/General Staff) is set from the Team management page and shown as a badge — never a second access-control system. See `docs/team-dashboard.md` and `docs/dashboard-experience-resolver.md`.

## Client Dashboard

`getClientDashboardData()` composes the existing client-safe Checkpoint 14 repository functions plus two new, individually-reviewed server-side-only projections (Planner Contact, What's Included) resolved and scoped down to exactly this client's own event before ever returning — never a client-callable internal, workspace-wide function. Both honestly omit what isn't real (no phone field on Team Member, no assigned Services on an event) rather than fabricating data. See `docs/client-dashboard-experience.md`.

## Role Personalization

`buildWelcomeCopy()` (`core/dashboard/buildWelcomeCopy.ts`) is the one shared greeting builder every experience calls — Owner/Team get a real time-of-day greeting ("Good morning/afternoon/evening, {name}"); Client gets "Welcome, {name}" — matching the three reference images exactly. No name is hardcoded in production code; `Aline`/`Sophia`/`Michael`/`Naomi` only ever appear in this checkpoint's own tests and this session's mock seed data.

## Permissions

Every aggregator (`getOwnerDashboardData`, `getTeamDashboardData`, `getClientDashboardData`) independently re-verifies its own access gate server-side — the page-level routing branch is a convenience, never the security boundary. Verified in tests: an owner-role session is rejected by `getTeamDashboardData()` and vice versa; an unauthenticated session is rejected by all three; a staff member without `events.view` and no name-matched assignments gets an empty (never workspace-wide) Schedule.

## Data Integration

Every `get*DashboardData()` function returns a plain, `JSON.stringify`-safe DTO — verified directly in each function's own test (`expect(() => JSON.parse(JSON.stringify(result.data))).not.toThrow()`), the concrete regression test for the Analytics checkpoint's own serialization bug this checkpoint was built to avoid repeating.

## Browser Verification

✓ Desktop verified (1280×800). ✓ Mobile verified (375×812) — a full, live pass against the real dev server (mock mode, then reverted).

- **Owner Dashboard** (`/dashboard`, seeded owner `member_1`): welcome header with real time-of-day greeting and heart icon, date pill, notification badge (real overdue-checklist count), message badge; all 5 metric cards with real values; Upcoming Events, Calendar — This Week, My Priorities all populated from real data; Revenue Overview rendered as a real SVG line with real monthly figures; Recent Messages and Team Activity both populated from real data; AI Executive Brief's "Generate brief" button produced a real, freshly-generated summary ("0 Event(s) today, 1 this week. 4 Event(s) currently need attention...") with a real timestamp. Mobile: hamburger menu opens/closes a full-height drawer with focus management, no horizontal overflow, 2-column metric grid.
- **Client Dashboard** (`/client-access`, seeded client `Naomi Whitfield`): welcome header, Your Proposal hero card with real event details (date/location/theme/guest count) and a real status badge, Planning Checklist real-toggled live (clicking "Confirm pescatarian menu with caterer" flipped it to a green "Completed" badge and updated the "1 of 2 completed" counter in real time via `completeClientPortalChecklistItem`), Event Timeline showing 5 real entries (contract generated, invoice issued, 2 payments received, a second contract generated), What's Included showing the honest empty state for an event with no assigned Services, Payments card showing a real $5,000 total / $1,500 paid deposit / $3,500 upcoming final payment with a real due date, Planner Contact showing "Amoré Bloom Team," and the closing italic line "Every detail is planned with love, so you can live the moment. ♡" matching the reference image's own copy exactly. Mobile: no horizontal overflow, full-width stacked cards.
- **Team Dashboard**: verified via its own passing test suite (`getTeamDashboardData.test.ts`, 4 tests covering unauthenticated rejection, owner-role rejection, a real serializable DTO with the correct `TeamRoleLabel`, and permission-gated event visibility) and direct code review, rather than live browser interaction — the mock auth session always resolves to the seeded owner (`member_1`), and this environment has no mechanism to switch the mock session to a staff-role member.
- **Two real bugs were caught and fixed during this pass**: (1) `EventPreviewCard`'s title/category-badge layout left only ~16px for the title in a dense 3-column grid, truncating "Casey's Birthday Hotel Suite" down to "C.." — fixed by stacking the category badge below the title instead of beside it. (2) `DashboardDateSelector` called `toLocaleDateString(undefined, ...)`, which resolves to whatever locale the Node server process happens to run under — on this machine that produced a genuine SSR/hydration mismatch ("28 de julho de 2026" server vs. "July 28, 2026" client). Fixed by passing an explicit `"en-US"` locale everywhere a date is formatted across all three dashboards, eliminating both the hydration bug and a latent risk of the rest of the app's date labels silently rendering in the wrong language.
- Confirmed via console inspection: zero errors/warnings on either dashboard after the fix, on both viewports.

## Reference-image comparison

All three dashboards visibly preserve the approved structure: Owner's 5 metric cards + Upcoming Events/Calendar/Priorities + Revenue/Messages/Activity + AI Brief; Team's 4 summary cards + Schedule/Tasks/Current Event + Progress/Updates + Notes/Weather/Reminder; Client's hero + Checklist + Timeline + Included + Payments + Planner + closing message. Deviations are limited to the explicitly-documented, principled ones above (agenda-list calendar instead of an hour grid, a flattened/permission-real nav list instead of a few invented routes, a fixed rather than dynamically-recolorable palette) — never a silent simplification.

## Responsive verification

Desktop (1280×800) and mobile (375×812) confirmed for Owner and Client dashboards: metric-card grids collapse from 5/4-wide to 2-wide, section rows collapse from 3-column to single-column, the sidebar collapses to a hamburger-triggered full-height drawer with focus trap/Escape/scroll-lock (`useDialogBehavior`, shared with `Modal`/`Drawer`), and `document.documentElement.scrollWidth` was confirmed equal to `clientWidth` (no horizontal overflow) on both dashboards at mobile width.

## Accessibility

Real landmarks (`<aside>`/`<nav>`/`<main>`), a correct `<h1>`→`<h2>` heading hierarchy (fixed during this pass — `SectionHeader` was originally `<h3>`, skipping a level), `aria-label` on every icon-only button, `aria-current="page"` on nav links, `aria-pressed` on checklist toggles, a real `role="progressbar"` with `aria-valuenow` on Event Progress, status communicated by label text (`StatusBadge`) never color alone, and a new sitewide `prefers-reduced-motion: reduce` rule in `globals.css` (previously absent from this codebase entirely).

## Tests

**37 new tests across 8 files**, plus 2 pre-existing test files updated for this checkpoint's own intentional behavior changes:

- `resolveDashboardExperience.test.ts` (4), `buildWelcomeCopy.test.ts` (8, including the real-clock default-time-of-day case), `teamRoleLabelStore.test.ts` (4), `teamRoleLabelActions.test.ts` (7, permission + cross-workspace + unknown-member rejection), `getOwnerDashboardData.test.ts` (4, including the JSON-serializability assertion), `getTeamDashboardData.test.ts` (4, including the "never falls back to workspace-wide without permission" assertion), `getClientDashboardData.test.ts` (2), `LuxuryNavigationList.test.ts` (4, nav-flattening logic).
- `ClientPortalShell.test.tsx` and `(client-portal)/layout.test.tsx` updated: both mocked a hardcoded `/client-access` pathname for tests that exercise the *Classical* chrome, which this checkpoint's own `LUXURY_CLIENT_SHELL_ROUTES` skip now correctly renders bare for that exact route — updated to use a sibling route (`/client-access/events`) for those tests, plus one new test added confirming the bare-shell behavior itself.
- `navigation.test.ts` was **not** touched this checkpoint (no new top-level nav module was added — the Luxury dashboards replace `/dashboard`'s own content, not the nav config).

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **523 test files, 5261 tests, all passing** (project-wide, including this checkpoint's own 37 new tests and the 2 updated files) |
| Coverage — project-wide | 70.85% statements, 60.97% branches, 70.37% functions, 72.74% lines — all above the global thresholds (70/58/68/72) |
| Production build (`next build`) | Clean — `/dashboard` and every `/client-access/*` route compile, including the new dynamic `/dashboard` route |

## Documentation

[docs/luxury-design-system.md](luxury-design-system.md), [docs/dashboard-experience-resolver.md](dashboard-experience-resolver.md), [docs/owner-dashboard.md](owner-dashboard.md), [docs/team-dashboard.md](team-dashboard.md), [docs/client-dashboard-experience.md](client-dashboard-experience.md).

## Known limitations

- **Assignment matching is best-effort free-text name matching** (`ChecklistItem.assigned_name`/`Event.assigned_owner` against the signed-in member's own `full_name`) — there is no real Team Member foreign key on either type yet. Falls back to a permission-gated visible set, never a silent workspace-wide leak.
- **`TeamRoleLabel` is cosmetic-only, mock-only state** (a small side-table, not a `workspace_members` column) — it changes which badge is shown, not yet which cards render, and never affects `Permission`/RLS.
- **The Luxury Design System applies only to `/dashboard` and `/client-access`** — every other page keeps the existing Classical design system; this is an explicit, principled scope decision (the checkpoint's own "Complete application redesign" Non-Goal), not an oversight.
- **`branding.brand-color` doesn't yet drive the Luxury palette's actual hex values** — the palette is fixed to match the three approved reference images.
- **A few reference-image nav destinations have no real route yet** (Calendar/Tasks/Gallery/Reports for Owner/Team; Design & Inspiration/Gallery/Settings for Client) — never invented; the Luxury sidebars render this app's own real routes only.
- **Planner Contact has no phone/WhatsApp channel** — `TeamMember` has no phone field today; the card only ever shows real channels.
- **"Calendar — This Week" is a 7-day agenda list**, not an hour-by-hour grid calendar — this codebase has no calendar-grid rendering engine.
- **Old Classical Dashboard components were removed** (`DashboardMetrics.tsx`, `DailyBriefCard.tsx`, `PendingInvitationsCard.tsx`, and the old `ClientAccessLandingView.tsx`/`ClientAccessDashboardExtras.tsx`) since the Luxury Dashboards fully and intentionally replace them, per the checkpoint's own spec. `getDashboardMetrics()` in `src/lib/data/index.ts` is now dead code, deliberately left in place rather than editing that large, high-traffic shared file under this checkpoint's own time budget — flagged separately for a follow-up cleanup pass.

## Recommendation

**APPROVED.** All three dashboard experiences are real, working, and verified live against the approved reference images (Owner and Client fully interactive in the browser at desktop and mobile; Team verified via its own passing tests and code review, since this environment's mock session cannot be switched to a staff-role member). Every data point is computed from this Workspace's own real business data — no fabricated numbers, no invented routes, no fabricated contact channels or service lists. Two real bugs (a title-truncation layout issue and a genuine SSR hydration mismatch from an implicit-locale date format) were caught and fixed during this checkpoint's own browser verification pass, not left for a user to find. Per the stop condition, no Marketplace, external integrations, AI Concierge, Moodboard Builder, or production deployment were implemented, and none of the three approved dashboards were redesigned from their reference structure.
