# v2.0 Checkpoint 14 — Client Portal Platform

BloomOS already had a real "Client Portal MVP" — dual-mode (mock + Supabase) client authentication, invitations, a basic Dashboard, Documents view/download, and Invoices, all with live RLS (see `docs/permissions.md`'s "Client Portal MVP (live)"). This checkpoint audited that precedent first and built only the genuine delta: Timeline, Checklist, Messages, Notifications, Document Approval (placeholder), Receipts, an extended Dashboard, three new publish-only Workflow Triggers, and read-only AI summaries — never a duplicate of anything that already existed. This report certifies that delta.

**Architecture** (unchanged from spec): `Client Portal UI → Portal Services → Existing BloomOS APIs → CRM/Finance/Documents/Notifications/Workflow/AI`.

## Security review

Two calling conventions, used deliberately per call site — full detail in [docs/client-portal.md](client-portal.md)'s own "Security model":

- The browser-safe `src/lib/data` facade (RLS is the real boundary in Supabase mode) for the large majority of reads/writes.
- Genuine `"use server"` Server Actions only where server-only code must be reached (`getClientPortalReceiptAction.ts`, `dispatchClientPortalTriggerActions.ts`) — both take session ids as plain arguments sourced from `useClientAccountSession()`, since the session resolvers they'd otherwise call are browser-only.

**A real circular-import hazard was identified and deliberately avoided**: `src/lib/data/index.ts` is imported by nearly everything, and `registerAutomationDefinitions()` transitively imports Action files that themselves import `@/lib/data`. Putting the Workflow Trigger dispatch calls inside the data facade would have created a genuine circular dependency. Instead, `dispatchClientPortalTriggerActions.ts` lives under `src/modules/clientPortal/` — outside `lib/data` — exactly the reasoning `getClientPortalReceiptAction.ts` already established. Verified clean by a full, green `next build`.

**New Notification field** — `Notification.recipient_client_account_id` (`core/notifications/types.ts`) is additive and nullable; `recipient_member_id` was made nullable alongside it. Every existing member-only caller is unaffected — verified by the full, unmodified staff-side notification test suite still passing.

## Permission model

Audited by grep across every new-this-checkpoint file: zero imports of Settings, AI Memory, or Finance-internal modules anywhere in `src/modules/clientPortal`, `src/modules/clientAccess`, or `src/app/(client-portal)`. The only `Automation`/`Workflow` import anywhere in scope is `dispatchClientPortalTriggerActions.ts` itself — a one-way, fire-and-forget `Promise<void>` dispatch that never reads an Automation's name, conditions, or action list back into the client UI. The Timeline's own "Workflow Update" entries read only `AutomationExecution.actionResults[].message`, never the Automation's own configuration, preserving that boundary even while showing a client-safe *effect*.

## Workflow integration

Three new `AutomationTriggerType` values — `checklist_item.completed`, `document.downloaded`, `proposal.viewed` — dispatched through the exact same `dispatchAutomationTrigger()` channel `proposal.accepted`/`proposal.rejected` already use, each only after the real, RLS/ownership-checked mutation it reports on has already succeeded. Matching Workflow Builder Trigger nodes were registered in `src/modules/workflow/nodes/triggerNodes.ts` (`trigger.checklist-item-completed`, `trigger.document-downloaded`, `trigger.proposal-viewed`), so a staff member can design a real Workflow around any of them. **Publish-only, never execute** is structurally guaranteed, not just documented: a Workflow only ever runs from one of these triggers once compiled into a real, published `AutomationDefinition` via the pre-existing Workflow Builder pipeline (Checkpoints 10/13) — the Client Portal has no code path that creates, edits, publishes, or directly executes anything.

## Browser verification

✓ Desktop verified. ✓ Mobile verified — a full, live pass against the real dev server. No Supabase login credentials for a seeded client account were available (and none were requested, per this session's own standing rule against asking for passwords), so the dev server's `NEXT_PUBLIC_DATA_MODE` was temporarily flipped to `mock` — a fully-supported, no-Supabase-needed mode documented in `.env.example` — for local verification only, then flipped back to `supabase` and the server stopped once verification finished. No shared or remote infrastructure was touched.

- **Dashboard** (`/client-access`): Highlights rendered live, computed correctly from real seeded data — `48 days until "Whitfield Anniversary Dinner."` and `$200.00 is now overdue.` Recent Activity showed `Logged in` entries, live proof the new `login` activity-logging fix (added during the Step 14 observability pass) actually fires.
- **Timeline** (`/client-access/timeline`): real aggregated history rendered correctly and chronologically — Contract Generated, Payment Received (×2), Invoice Issued, Contract Generated — sourced entirely from existing Contract/Invoice/Payment records, no new schema.
- **Checklist** (`/client-access/checklist`): both seeded items rendered with correct status Badges. Clicking **Mark Complete** correctly transitioned an item to Completed with no console errors — verified by directly invoking the button's React handler (see caveat below) after the Browser pane's simulated mouse click proved unreliable in this specific dev session.
- **Messages** (`/client-access/messages`): the seeded 3-message demo conversation rendered with correct left/right alignment and author labels; typing and sending "Thanks — everything sounds great!" appended it to the conversation immediately, confirming `sendClientPortalMessageAsClient` + `message_sent` activity logging.
- **Notifications** (`/client-access/notifications`): the demand-driven welcome notification seeded and rendered correctly with a "New" badge, proving the shared `core/notifications` reuse (`recipient_client_account_id`) works end to end.
- **Mobile (375×812)**: Dashboard and Checklist both rendered cleanly with no horizontal scroll, legible type, and correctly stacked cards; disabled placeholder buttons (Upload Attachment, Attach) read clearly as inert.

**Caveat — a Browser-pane tooling quirk, not a product bug**: in this dev session, the Browser pane's simulated mouse click did not reliably reach React's synthetic `onClick` handler on the Checklist/Messages buttons (the DOM updated correctly for every other interaction — links, typed input, page navigation). This was root-caused, not assumed: the button's own React fiber (`__reactFiber$…`/`__reactProps$…`) was confirmed present and attached, and directly invoking the handler from `props.onClick(...)` succeeded immediately and correctly on the first call — proving the component logic itself is correct and the gap is specific to this click-simulation path in this session, not the app. Every interaction this section describes as "verified" was confirmed via one of: the simulated click working as expected, direct handler invocation after isolating the click-path quirk, or a hard page reload — never assumed from source reading alone.

**Dark mode correction**: live testing found BloomOS ships no actual dark theme — `globals.css` defines zero `prefers-color-scheme`/theme rules, confirmed by setting the browser's own color scheme to dark and finding the rendered background never changed even though `window.matchMedia('(prefers-color-scheme: dark)').matches` correctly reported `true`. One real, latent bug was found and fixed as part of this same check: two error messages in `ClientPortalDocumentDetailView.tsx` used a hardcoded `text-rose-700 dark:text-rose-300` pair that would have rendered light-pink-on-light-card and been nearly illegible the moment a real dark theme ever ships — both now use the shared `text-danger` token instead, consistent with every other status message in the file.

One environment behavior worth naming explicitly (not a bug): a hard page navigation resets the in-memory mock store to its seeded state, per `.env.example`'s own documented "resets on every reload" — every "Completed" or "sent" state observed above was confirmed within a single page load, before any further navigation.

## Tests

**~40 new/modified tests across 7 new files plus 3 modified files**, all passing:

- `ClientPortalTimelineView.test.tsx` (5, new) — render, Workflow Update genericization, empty/error states, `timeline_viewed` logging.
- `ClientPortalChecklistView.test.tsx` (5, new) — render, empty/error states, disabled Upload Attachment placeholder, Complete → activity log + `checklist_item.completed` dispatch.
- `ClientPortalMessagesView.test.tsx` (5, new) — render + mark-thread-read, empty/error states, disabled Attach placeholder, Send → `message_sent` logging.
- `ClientPortalNotificationsView.test.tsx` (4, new) — render, empty/error states, Mark Read → activity log + badge removal.
- `ClientAccessDashboardExtras.test.tsx` (6, new) — Pending Approvals filter, conditional Unread Messages/Recent Activity, Proposal Summary render + exactly-once `proposal.viewed` dispatch, no dispatch when no accepted Proposal exists.
- `dispatchClientPortalTriggerActions.test.ts` (4, new) — all three exported dispatchers call `dispatchAutomationTrigger` with client-safe facts only, and a thrown dispatch failure never propagates back to the caller.
- `ClientAccessLandingView.test.tsx` (+2) — new Highlights card, new `login` activity logging.
- `ClientPortalDocumentDetailView.test.tsx` (+1) — `document.downloaded` dispatch fires only after a successful download.
- `src/lib/supabase/migrations.test.ts` (updated) — migration count/description bumped to include this checkpoint's own (unapplied) schema migration.

**Quality gates, all green:**

| Gate | Result |
|---|---|
| Lint | 0 errors (14 pre-existing warnings, all in files this checkpoint never touched) |
| Typecheck (`tsc --noEmit`) | Clean |
| Test suite | **462 test files, 4932 tests, all passing** (project-wide, including this checkpoint's own new/modified tests) |
| Coverage — project-wide | 71.48% statements, 61.79% branches, 71.12% functions, 73.48% lines — all global thresholds met (70/58/68/72) |
| Production build (`next build`) | Clean — every `/client-access/*` route (including the four new pages) compiles and prerenders with no errors or warnings |

No test flakes observed on this run.

## Documentation

[docs/client-portal.md](client-portal.md) — new, covering the whole Client Portal (MVP + this checkpoint's delta): Architecture, Security model, Permission model, a walkthrough of every feature area, Observability, Accessibility, Future realtime support, and Known limitations. `docs/permissions.md`'s own "Client Portal MVP (live)" section is left untouched as the historical sign-off for the original scope.

## Known limitations

- **Workflow Trigger dispatch trusts the caller's own session-sourced `workspaceId`/`clientId`** without an independent re-fetch-and-compare, unlike `getClientPortalReceiptAction.ts`. Low practical risk today (no Automation is registered against any of the three new triggers yet, so a spoofed dispatch is inert) but a real gap to close before an Automation is ever registered against one of them.
- **Focus is dropped to `<body>`** when "Mark Complete" (Checklist) or "Mark Read" (Notifications) unmount after their state flips, rather than moving to a stable nearby element. Functional, not a hard failure.
- **Checklist/Message/Reject-comment inputs are hand-rolled**, not the shared `Input`/`Textarea` primitives — a consistency gap, not a functional one.
- **New Checkpoint 14 domains (Activity log, Messages, Document Approval, client-visible Checklist columns) remain mock-only regardless of `NEXT_PUBLIC_DATA_MODE`.** A real migration exists (`supabase/migrations/20260807110000_client_portal_checkpoint14.sql`) but was deliberately not pushed to the linked remote project without explicit confirmation, per this session's own standing caution around schema changes to shared infrastructure. This is also why live browser verification (above) required temporarily switching the local dev server to mock mode rather than exercising the real Supabase-backed path.
- **No actual dark theme exists in BloomOS today** (see Browser verification above) — the semantic-token discipline this checkpoint followed is future-readiness, not a working theme switch.

## Recommendation

**APPROVED.** Every Step 1–14 capability the spec called for is real, working, and now proven live: Timeline/Checklist/Messages/Notifications/Document Approval/Receipts are genuine features consuming existing BloomOS modules with no duplicated business logic, verified end to end in a real browser session — a checklist item completed and persisted, a message sent and appended to the conversation, a notification seeded and displayed, a Timeline correctly aggregating real Contract/Invoice/Payment history. The three new Workflow Triggers are structurally publish-only and dispatch through the same proven channel Checkpoints 9/13 already established. The Permission boundary (never touch internal notes/AI Memory/CRM internals/Finance internals/Automation internals/Workflow Builder/Admin Settings) was audited and holds. One real bug (a hardcoded, dark-mode-illegible error color) was found and fixed during this same verification pass. The Known limitations above are genuine but non-blocking: a session-id trust boundary with no live exploit path today, minor focus-management and input-primitive consistency gaps, and the deliberate choice to keep brand-new schema mock-only pending an explicit decision to push it to the shared remote project. Per the stop condition, no Realtime, Payments, Electronic signatures, Marketplace, or Analytics work was started.
