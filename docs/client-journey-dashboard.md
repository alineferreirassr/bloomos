# Client Journey Dashboard & Detail

`modules/clientJourney/components/{ClientJourneyDashboardView,JourneyDetailView}.tsx`, routed at `/client-journeys` and `/client-journeys/[id]`; also embedded additively as `ClientJourneySummaryCard`/`LeadJourneySummaryCard` on Client Detail and Lead Detail.

## Dashboard (`/client-journeys`)

Reads `listClientJourneysAction()` once and renders: 4 KPI cards (Active/At Risk/Blocked/Average Health), a Type filter (Lead/Client), a Stage filter with 15 named buckets each covering the spec's own named groupings (New Leads, Contact Pending, Proposal Pending, Contract Pending, Signature Pending, Deposit Pending, Welcome Pending, Portal Setup Pending, Planning, Service in Progress, Final Balance Pending, Follow-Up Due, Review Pending, Rebooking Opportunities, Lost and Cancelled), and the filtered list itself with severity badges and a deep link to each journey's Detail page.

## Journey Detail (`/client-journeys/[id]`)

A composite id (`journeyRouteId(subjectType, subjectId)`, since a Journey has no persisted id of its own — see [`client-journey.md`](client-journey.md)'s Storage split) resolves back to the real subject. The page reads `evaluateClientJourneyAction` once and renders Progress/Health/Blocker-count KPI cards, Next Best Actions, Blockers, Risks, Milestones (a checklist), Ownership (6 named roles, inline-editable), Information Requests (client subject only), and Internal Notes & Comments via the existing `CommentsPanel` (`ownerType` is the subject's own `lead`/`client` type — the journey itself never gets its own `EntityType`).

**Wired mutations**: Cancel/Restore (via `transitionClientJourneyAction`), owner assignment (via `assignJourneyOwnerAction`), and Information Request create/respond. Every other Next Best Action links out to the real source module (`/leads/[id]`, `/clients/[id]`, the deep link on the action itself) rather than performing the action itself — Journey Detail never becomes a second place actions actually happen.

## Client/Lead Detail integration (Step 10-11)

`ClientJourneySummaryCard`/`LeadJourneySummaryCard` are additive — they slot into the existing approved Client/Lead Detail structure as one more `<Card>`, self-fetching their own data, and never touch the existing page's own data-loading pipeline. Convert-to-Client stays entirely on the existing `LeadActions` component; the Lead Journey card only links out to it, never duplicates it.

## Accessibility

Every list uses `role="list"`/`"listitem"`; severity/status/stage are always paired with a text label next to the color (`Badge`); every milestone uses a `✓`/`○` glyph plus a text label, never color alone; every action is a real `<button>`/`<a>` reachable by keyboard.

## Known gap

No live authenticated browser verification — the dev environment requires a real sign-in this session has no credentials for. Verified instead through 9 component tests (`ClientJourneyDashboardView.test.tsx`/`JourneyDetailView.test.tsx`) exercising the actual rendered UI against mocked module actions, plus a successful `next build` of all three routes.
