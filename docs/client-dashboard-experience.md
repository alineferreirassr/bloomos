# Client Dashboard

Checkpoint 19, Step 9. Rendered at `/client-access`, fully replacing the previous `ClientAccessLandingView`. Matches the approved Client reference image's own structure exactly: Your Proposal hero, Planning Checklist, Event Timeline, What's Included, Payments, Planner contact, closing emotional message.

## Data source

`getClientDashboardData()` (`src/modules/clientAccess/getClientDashboardData.ts`, `"use server"`) composes:

- `getClientPortalOverview()`, `getClientPortalChecklist()`, `getClientPortalTimeline()`, `getClientPortalContracts()` — all pre-existing, already client-safe Checkpoint 14 repository functions.
- Two **new** projections, described below.
- `branding.logo-url`/`branding.client-welcome-message` from the existing Settings Registry (Step 10).

## Security model

Every `ClientPortal*` type in this codebase is deliberately a hand-reviewed, client-safe **projection** of an internal type — `ClientPortalEvent` explicitly excludes `assigned_owner` (staff assignment), for example. This checkpoint needed two new pieces of information a Client Account has never been allowed to see a raw version of: **Planner Contact** and **What's Included**.

Rather than call internal, workspace-wide functions (`getEvents`, `getWorkspaceMembers`, `listEventServicesByEvent`) from client-side code — which would mean a compromised or malicious client browser could, in principle, request other clients' events or the full internal staff list — both projections are resolved **entirely server-side, inside `getClientDashboardData()` itself**, scoped down to exactly this one client's own event before anything is returned:

1. Resolve `getCurrentClientAccountContext()` — this client's own `client_id`/`workspace_id`. If there is no active client session, the whole call fails closed (`GENERIC_ACCESS_ERROR`), never a partial result.
2. Find this client's own event among `getEvents()`'s full workspace list — the internal call happens, but only the one matching row is ever used.
3. **Planner Contact** — the event's own `assigned_owner` (free text), matched against `getWorkspaceMembers()` by name (falling back to the workspace's own owner if unset), projected down to `{name, avatarUrl, email, phone}` only — never the full `TeamMember` row.
4. **What's Included** — `listEventServicesByEvent(ownEvent.id)`, projected down to `{id, label}` per service — never the full `EventService` row (no price, no internal notes).

## Planner Contact — no fabricated phone number

`TeamMember` has no phone/WhatsApp field today. `PlannerContactCard` only ever renders a channel that's a real field on the resolved member — `phone` stays `null` and that row is simply omitted, never invented. See Known limitations.

## What's Included — no fabricated package list

An event with no assigned Services renders the honest `IncludedServicesGrid` empty state ("No services assigned yet... once your planner assigns services to your event, they'll appear here") rather than a generic static package list. Verified live: a seeded event with zero assigned Services showed exactly this empty state.

## Payments

`Total`/`Deposit`/`Final Payment` are derived from the matching `ClientPortalContract`'s own `total_value`/`deposit_amount`/`remaining_balance` (converted from the Contract model's legacy major-unit numbers via `majorToMinor()`, the same conversion `financialSummary.ts` already uses) — never a second, independently-maintained payment ledger.

## Client Dashboard's own sidebar

`CLIENT_NAV_ENTRIES` (`src/modules/dashboard/luxury/clientNavEntries.ts`) mirrors the existing `ClientPortalShell`'s own real nav list (Dashboard, My Event, Timeline, Contracts, Planning Checklist, Payments, Messages, Documents, Notifications) with Luxury icons — the reference image additionally shows "Design & Inspiration," "Gallery," and "Settings," none of which have a real Client Portal page yet, so they're not invented (see Known limitations).

## Known limitations

- **No phone/WhatsApp field exists on a Team Member profile** — the Planner Contact card only ever shows real channels (name, avatar, email).
- **"Design & Inspiration," "Gallery," and "Settings"** are named in the reference image but have no real Client Portal route yet — omitted rather than faked.
- **Checklist completion is real** (`completeClientPortalChecklistItem`, an existing Checkpoint 14 mutation) — verified live toggling a real item.
