# Unified Client Portal

Checkpoint 36 is the Client Portal's own orchestration layer — Portal Home, one nav, one Dashboard extension — over the eleven platforms already built for it across Checkpoints 14 and 32–35 (Journey, Proposal, Contract, Billing, Documents, Communication/Timeline, Checklist, Notifications). Per the checkpoint's own explicit rule: **this checkpoint does not create new business logic.** Every Center is a thin composition of already-existing, already-tested actions and engines; where a genuine gap existed (Announcements, Comments, Journey Notes, Profile/Settings preferences, Knowledge Graph connections), it's disclosed below rather than folded silently into "reuse."

## Portal Home (Step 1)

`getClientDashboardData()` (`modules/clientAccess/getClientDashboardData.ts`) is both the Checkpoint 19 Client Dashboard aggregator *and*, as of this checkpoint, Portal Home: its `portalSummary` field (`PortalHomeSummaryData`) composes `getClientPortalJourneySummaryAction`, `getClientPortalThread`, `listClientPortalProposalsAction`, `getClientPortalAnnouncementsAction`, and fields the Dashboard already computed (open contracts, outstanding balance, recent documents) — one aggregator, not a second dashboard. `recentActivity` reuses the shared `ActivityFeedList` primitive, fed from the Communication Center's own comments aggregator. See [`client-portal-widgets.md`](client-portal-widgets.md) for the rendering side.

## The eleven Centers, at a glance

| Center | Step | Composes | Doc |
|---|---|---|---|
| Portal Home | 1 | Journey/Messages/Proposals/Announcements summaries | this doc, [`client-portal-widgets.md`](client-portal-widgets.md) |
| Journey Experience | 2 | `buildClientJourney`, Information Requests engine | [`client-portal-journey-experience.md`](client-portal-journey-experience.md) |
| Proposals | 3 | Proposal Platform (Checkpoint 33) | `proposal-client-portal.md` |
| Contracts | 4 | Contract Platform (Checkpoint 34) | `contract-client-portal.md` |
| Billing | 5 | Invoice Platform (Checkpoint 35) | `client-billing.md` |
| Documents | 6 | Document Platform categories | [`client-portal-document-center.md`](client-portal-document-center.md) |
| Communication | 7 | Messages, Notifications, Announcements, Comments | [`client-portal-communication-center.md`](client-portal-communication-center.md) |
| Timeline | 8 | `getClientPortalTimeline` (Checkpoint 14) | [`client-portal-timeline-center.md`](client-portal-timeline-center.md) |
| Tasks | 9 | Checklist (`client_visible` items) | [`client-portal-task-center.md`](client-portal-task-center.md) |
| Events | 10 | `getClientPortalEventById`, Knowledge Graph | [`client-portal-event-center.md`](client-portal-event-center.md) |
| Profile / Settings | 11–12 | Real `Client` record + new preferences store | [`client-portal-profile-settings.md`](client-portal-profile-settings.md) |

Intelligence wiring (Knowledge Graph aggregation, Executive Decisions, Portal Analytics — Steps 14–16) is covered together in [`client-portal-intelligence.md`](client-portal-intelligence.md), since all three are thin translation seams over engines this checkpoint doesn't own.

## Navigation (Step 18)

`CLIENT_NAV_ENTRIES` (`modules/dashboard/luxury/clientNavEntries.ts`) is the single shared nav array consumed by both `LuxuryClientSidebar` (desktop) and `LuxuryClientMobileNavigation` (mobile drawer) — one edit reaches both surfaces. It was extended from 9 to 13 entries this checkpoint (Journey, Proposals, Communication, Settings were missing) to match the "classical" `ClientPortalShell.tsx`'s own already-complete `NAV_ITEMS`, which served as the reference for what the Luxury nav lacked. The Communication entry uses `InboxIcon` rather than `CommunicationsIcon` — the latter renders a Bell glyph (built for the internal Communication Platform's own nav) that would have visually collided with the adjacent Notifications bell.

## Permissions (Step 17)

Every Center a client visits is gated by their own `ClientAccountContext` session (`getCurrentClientAccountContext()`) — never the internal team's `PERMISSIONS` catalog, since a client account has no role or grant to check. Two genuinely new *internal*-facing capabilities were added instead: `client_portal.view` (viewing a client's own Portal Activity log from their Client record — the new `ClientPortalActivitySection`) and `client_portal.manage` (toggling a Checklist item's `client_visible` flag). See [`client-portal-task-center.md`](client-portal-task-center.md) for the second, and `src/core/enums/permission.ts`'s own Checkpoint 36 comment for the full accounting of which surfaces reuse an existing permission (`clients.portal_view`, `communications.manage`, `analytics.view`) instead.

## What was not built

No second CRM, no second Journey/Proposal/Contract/Invoice/Document/Communication/Timeline engine, no new AI model, and no payment processing beyond what Checkpoints 22–23 already wired. Where a Center's own spec line implied new business logic (Journey Notes, Comments-as-Communication, Profile preferences), the fix was to find the narrowest possible new read/write and compose everything else — see each Center's own doc for the specific accounting.
