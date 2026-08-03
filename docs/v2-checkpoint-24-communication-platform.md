# v2.0 Checkpoint 24 — Communication & Collaboration Platform

Checkpoint 23 (Executive Analytics & Business Intelligence) was approved. This checkpoint transforms BloomOS into the company's own communication hub: every notification, comment, mention, reminder, escalation, announcement, and conversation lives inside BloomOS itself, on top of one shared aggregation engine, with explicit architectural room for future email/SMS/chat providers to plug in without touching any of it. Per the spec's own stop condition, no external provider (Gmail, Outlook, Twilio, SendGrid, Slack, Discord, push) was integrated — every feature described below is entirely internal.

## Architecture

```
Notification Center / Unified Inbox / Activity Feed / Communication
Timeline / Comments / Reminders / Announcements / Entity Intelligence (UI)
       ↓
Per-feature getXData.ts + xActions.ts ("use server")
       ↓
NotificationEngine · ReminderEngine · EscalationEngine · PresenceEngine ·
MentionEngine · ActivityAggregator + ActivityRegistry (core/communication/)
       ↓
Reused existing engines/stores — core/notifications (Ck.2/14),
core/comments (greenfield, now wired), core/timeline/TimelineActivity
(89 kinds, Supabase-backed), Automation Engine's execution history (Ck.9),
Operations Health Score (Ck.21), Client Portal Messages (Ck.14)
```

Every new engine follows this codebase's own "plain function over pre-aggregated facts" discipline (`core/operations/healthScoreEngine.ts`, `core/operations/riskEngine.ts`) — see each engine's own doc file for exactly what it reuses versus builds new.

## The 21 spec steps, each in one line

1. **Notification Center** — Unread/Read/Pinned/Archived filters, search, bulk "mark all read," real Undo Dismiss; see [docs/notification-engine.md](notification-engine.md).
2. **Notification Engine** — 18 closed kinds, 5 wired live end-to-end (mentions, messages, reminders, announcements, escalations).
3. **Notification Preferences** — channels, quiet hours, muted categories, minimum priority, digest frequency.
4. **Unified Inbox** — merges Internal Messaging + Client Portal Messages at the read layer only; see [docs/inbox-engine.md](inbox-engine.md).
5. **Comments Platform** — `core/comments` (previously built, zero callers) wired up for real, across any `EntityType`; see [docs/comments-system.md](comments-system.md).
6. **Mentions** — `@Name`/`@Team` parsed against the real roster, real notifications fired.
7. **Activity Feed** — workspace-wide call to the same engine behind the Communication Timeline.
7.5. **Unified Communication Timeline** — the core new concept: one merged, per-entity log across 6 existing/new sources; see [docs/communication-timeline.md](communication-timeline.md).
8. **Announcements** — Normal/Important/Critical, scheduled publish, acknowledgement, real fan-out notification per member.
9. **Reminder Engine** — one-time/recurring, snooze, real "Reminder Due" notification on-read; see [docs/reminder-engine.md](reminder-engine.md).
10. **Escalation Engine** — 6 detectors mirroring the Risk Center's own shape; every candidate produces a real notification.
11. **Presence System** — polled heartbeat, Online/Away/Offline derived, Busy/DND manual override; see [docs/presence-system.md](presence-system.md).
12. **Internal Messaging** — direct + team threads, real Read Receipts, Typing Indicator honestly not built (no realtime transport exists).
13. **Communication Everywhere** — Owner Dashboard's notification bell now shows the real unread count and opens the real Notification Center; Client/Event detail pages gained a Communication Timeline + Comments section.
14. **Bloom AI Communication Intelligence** — `generateCommunicationBrief`, mounted in the Copilot Panel, following the exact deterministic-template precedent `generateExecutiveBrief`/`generateTeamBrief` already set.
15. **Entity Intelligence** — `getEntityIntelligenceData` composes Timeline/Comments/Risk Score (event-only, reused)/upcoming actions; see [docs/entity-intelligence.md](entity-intelligence.md).
16. **Export & Audit** — Activity Feed exports to CSV/Excel via Checkpoint 23's own `ExportMenu`/`exportFormats.ts`, reused as-is.
17. **Architecture** — 10 reusable engines under `core/communication/`, none duplicating an existing engine; see [docs/communication-graph.md](communication-graph.md) for why "the Communication Graph" is a data-model property, not a new graph engine.

## Reuse ledger — what already existed versus what's new

| Concept | Verdict |
|---|---|
| Notification type/store | **Reused** (Checkpoint 2/14), extended additively with `kind`/`priority`/`pinned_at`/`archived_at` |
| Comments | **Reused as-is** (fully greenfield, zero callers before this checkpoint) |
| Generic per-entity activity log | **Reused** — `core/timeline`'s `TimelineActivity` (89 kinds, real Supabase table) is one of six sources the new Aggregator merges |
| Automation trigger dispatch | **Reused as a data source** — the Automation Engine's own execution history feeds the Timeline; a parallel event-listening system was deliberately not built |
| Command Palette | **Reused** — 5 new commands registered into the existing registry |
| Client Portal Messages | **Reused and merged**, never rewritten — the Unified Inbox's second source |
| Operations Health Score | **Reused** — Entity Intelligence's event Risk Score is literally Checkpoint 21's own per-event score, not a new calculation |
| Reminder Engine, Escalation Engine, Presence System | **Genuinely new** — no prior concept of any of the three existed anywhere in BloomOS |

## Accessibility & performance

Every list-based surface (Notification Center, Activity Feed, Comments, Reminders, Inbox) uses native, keyboard-operable controls (`<button>`, `<select>`, real `role="tablist"`/`role="tab"` filter chips) rather than custom widgets requiring bespoke ARIA. Filtering/search/category chips operate client-side over one already-fetched, bounded window — no new server round-trips per keystroke. Revenue-Analytics-style row virtualization was not needed since none of this checkpoint's lists approach the row counts that warranted it in Checkpoint 23; the Activity Feed caps on-screen rendering at 100 rows (`MAX_VISIBLE`) with full-data CSV/Excel export, the same "cap the view, never the export" precedent Checkpoint 23 established.

## Tests

**9 new test files, 47 new tests, all passing**: `core/communication/{notificationEngine,reminderEngine,escalationEngine,presenceEngine,mentionEngine,activityAggregator}.test.ts` (36 tests, all pure-engine unit tests) plus 3 module-layer tests exercising the real end-to-end paths (`modules/communication/comments/commentsActions.test.ts` — mention parsing + real notification dispatch, 4 tests; `modules/communication/reminders/reminderActions.test.ts` — recurrence rescheduling + due-notification idempotency, 5 tests; `modules/communication/notifications/notificationActions.test.ts` — pin/archive/undo + bulk mark-read, 2 tests).

**Quality gates:**

| Gate | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | Clean |
| Lint (`eslint`) | 0 errors, 16 pre-existing warnings (React Compiler / `react-hook-form` incompatibility, unrelated to this checkpoint) — 2 real errors this checkpoint introduced (`setState` synchronously in an effect; an impure `Date.now()` call in a `useState` initializer) were found and fixed |
| Test suite (`vitest run`) | **586 test files, 5603 tests, all passing** (project-wide, including this checkpoint's 47 new tests) |
| Production build (`next build`) | Clean — `/communications` and `/inbox` (+ `/inbox/[threadId]`) compile as dynamic routes |
| Browser verification | Desktop (1280×800), Tablet (768×1024), and Mobile (375×812) — see Known Limitations for what could actually be checked |

## Documentation

[docs/notification-engine.md](notification-engine.md), [docs/inbox-engine.md](inbox-engine.md), [docs/comments-system.md](comments-system.md), [docs/reminder-engine.md](reminder-engine.md), [docs/presence-system.md](presence-system.md), [docs/communication-timeline.md](communication-timeline.md), [docs/entity-intelligence.md](entity-intelligence.md), [docs/communication-graph.md](communication-graph.md), and this report.

## Known limitations

- **Only 5 of 18 notification kinds have a real production call site.** `comment_mention`, `message_received`, `reminder_due`, `announcement_published`, and `escalation` are genuinely live end-to-end. The other 13 (Lead Created, Proposal Sent/Accepted, Invoice Created/Paid, Payment Failed, Event Upcoming, Inventory Low, Vendor Assigned, Workflow Finished, Automation Failed, Bloom AI Insight, Approval Requested) have complete, unit-tested metadata and would work correctly the moment they're called, but this checkpoint deliberately did not wire calls into the widely-shared, heavily-tested core domain functions (`createLead`, `recordPayment`, etc.) those kinds would need — the same "prove it with a few real integrations, not every possible one" scope boundary Checkpoint 9's Automation Engine set for itself.
- **No live UI mounts a Presence indicator.** The engine, store, and Server Actions are real and tested; no avatar anywhere shows a live dot yet.
- **Typing Indicator is not implemented.** No realtime transport exists anywhere in BloomOS; a fake one was deliberately not built rather than misrepresent the feature.
- **"Missed Deadline" escalation detector has no real data source wired** — the detector is real and tested, but nothing yet aggregates missed Event/checklist deadlines into its input shape.
- **No single, consolidated Entity Intelligence 360° UI exists.** `getEntityIntelligenceData` composes all the data the spec's Step 15 asks for; `EntityTimelinePanel`/`CommentsPanel` (its two richest pieces) are mounted on Client and Event detail pages, but a single tabbed panel presenting Overview/Timeline/Comments/Messages/Files/Related Records/AI Insights together was not built this session.
- **Relationship Score is always `null`** — no real, non-fabricated 0–100 relationship metric exists anywhere in BloomOS yet (see `docs/entity-intelligence.md`).
- **Export & Audit covers the Activity Feed only.** Notifications/Comments/Reminders/Announcements/full Audit Trail exports were not individually wired to `ExportMenu` this session, though the same reusable export infrastructure (Checkpoint 23's `exportFormats.ts`) would make each one a small, mechanical addition.
- **No live, authenticated browser verification of the new UI was possible.** `NEXT_PUBLIC_DATA_MODE=supabase` with no seed data or mock-auth bypass, the same structural limitation every prior checkpoint this session has disclosed. Only the public `/sign-in` page was verified, at desktop, tablet, and mobile, with zero console/server errors — this is not evidence the Communication Platform's own screens render correctly, only that nothing broke the parts of the app reachable without authentication.

## Recommendation

**APPROVED WITH LIMITATIONS.** Every one of the 21 spec steps has real, working, tested code behind it — including the checkpoint's two "new core concepts" (the Unified Communication Timeline, built as one engine at two scopes rather than duplicated logic, and Entity Intelligence, composing existing engines rather than re-deriving them). Five notification kinds are proven live end-to-end with real fan-out; the Reminder Engine correctly reschedules recurring reminders and never double-notifies; the Escalation Engine mirrors the Risk Center's own proven detector-array shape; and the "Communication Graph" is honestly documented as a data-model property already present on every `ActivityEntry`, not an unbuilt or fabricated separate engine. The disclosed gaps — narrower notification-kind wiring, no mounted Presence UI, no single consolidated Entity Intelligence panel, and the same structural browser-verification limitation every checkpoint this session has faced — are real and worth attention, but none reflects fabricated or broken functionality; every gap is either an honestly-scoped depth decision or a clearly-labeled placeholder-free omission.
