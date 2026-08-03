# v2.0 Checkpoint 21 — Luxury Event Operations Platform

Transforms BloomOS into a complete operational platform for luxury event companies: every Event becomes its own operational workspace, with a Command Center, a Live Event Mode for event day, a unified Operations Timeline, a Packing Assistant, a Logistics Center, Team/Vendor/Purchase/Budget/Inventory Operations, an extended Health Score, a Risk Center, a workspace-wide Operations Dashboard, mobile-ready touch targets, an extended Bloom AI Copilot, and Operations Reports. Operations and integration work only — no visual redesign, no Design System changes, no Dashboard redesign, no route/permission architecture changes beyond additive route entries, no external integrations.

## Architecture

Every new engine lives under `src/core/operations/` as a pure function over already-fetched data (`HealthScoreEngine`, `RiskEngine`, `PackingEngine`, `LogisticsEngine`, `BudgetEngine`, `TimelineEngine`), plus one stateful piece (`OperationsStore`, mock-only, for Live Event Mode's log). Six data-assembly seams under `src/modules/operations/` (`eventOperationsData.ts`, `operationsDashboardData.ts`, `teamOperationsData.ts`, `vendorOperationsData.ts`, `purchaseOperationsData.ts`, `operationsReportsData.ts`) fetch real data and run it through the engines — each a plain client-callable function, never a `"use server"` action, for the same Supabase-browser-binding reason every Bloom AI Copilot data function from Checkpoint 20 already established. Full detail: [docs/operations-engine.md](operations-engine.md).

## Command Center

Mounted on the existing `/events/[id]` page, replacing the literal "Future Integrations — reserved for upcoming modules" placeholder that already named exactly what this checkpoint builds (Team assignments, Vendors, Inventory). Shows Countdown, Health Score v2, Risk Center, Team/Vendor/Purchase/Budget summary tiles, the Packing Assistant, the Logistics Center, the Operations Timeline, Weather (the Event's own real field), and a Live Event Mode launcher. Full detail: [docs/event-command-center.md](event-command-center.md).

## Operations Timeline

A staff-facing unified milestone feed (Proposal Created → Deposit Paid → Flowers Ordered → Inventory Reserved → Vendor Assigned → Team Assigned → Setup Started → Client Arrived → Event Completed → Gallery Delivered → Review Received), following the Client Portal Timeline's own aggregator pattern from Checkpoint 14 but deliberately separate (internal-only detail, never client-safe-limited). Every milestone maps to a real record; two (Gallery Delivered, Review Received) are honestly derived from the closest real proxy since no dedicated field exists for either. See [docs/operations-engine.md](operations-engine.md#operations-timeline).

## Packing Assistant

Extends the packing/shopping split `eventAssistant.ts` (Checkpoint 20) already derives from real `EventServiceInventoryRequirement` rows, adding categorization into the spec's 10 named buckets via a keyword classifier matched against each item's own real inventory category/subcategory/tags — nothing hardcoded item-by-item. Each inventory-backed item gets a real **Reserve** action, the first real caller of the `InventoryMovement` reservation plumbing (`movement_type: "reservation"`, `reference_type: "event"`) that existed but was unused since the Inventory Foundation phase.

## Health Score

`HealthScoreEngine` extends — never forks — the existing `eventHealth.ts` (Checkpoint 19), adding 10 operational factors (financial, inventory, vendor, team, purchase, timeline, documents, budget) on the same 0–100 scale, then classifying into the spec's own Excellent/Good/Attention/Critical bands. `eventHealth.ts`'s own Ready/Waiting/Blocked classification is untouched and still used for its own audiences (the Event Health sidebar card, the Operational Pipeline Kanban). Full detail, including why the Operations Dashboard deliberately uses the cheaper base score for its own breadth: [docs/health-score.md](health-score.md).

## Assistants (Steps 6–10)

- **Team Operations** (`/team/operations`) — every member's own operational view (Today's Events, Assigned Tasks, Timeline, Shift Status), reusing the exact `Event.assigned_owner === fullName` matching convention `generateTeamBrief` already established. "Inventory assignments" and "internal team messaging" are honestly disclosed as not modeled in this codebase, rather than fabricated.
- **Vendor Operations** — a new `VendorOperationsCard` on `VendorDetailView.tsx` showing real Assigned Events and Purchase History (the closest real proxy for "Payments"/"Rating," neither of which has a Vendor-scoped field in this codebase).
- **Purchase Center** — a new `PurchaseAssignedEventsCard` on `PurchaseDetailView.tsx` filling the one genuinely missing piece (Requests/Ordered/Delivered/Received/Supplier/Cost/Status were already fully modeled by the pre-existing Purchases module).
- **Budget Center** — `BudgetEngine`, surfaced on the Command Center; see Architecture above.
- **Inventory Operations** — Reserve/Release/Damage/Checkout already existed generically on `InventoryItemDetailView.tsx` (`InventoryMovementActionsSection`); this checkpoint's own contribution is connecting Reserve to a *specific Event* from the Command Center's Packing Assistant, the first real use of the event-scoped reservation fields.

## Risk Center

`RiskEngine` — 8 pure detector functions, one per required risk kind, following the Event Operations Brief's own detector-list precedent from Checkpoint 2. Surfaced per-event on the Command Center and workspace-wide (as Health Scores + Alerts) on the Operations Dashboard.

## Operations Dashboard

A new workspace-wide page (`/operations`): Events Today, Upcoming Events (14d), Late Tasks, Inventory Alerts, Purchase Alerts, Vendor Alerts, Payments, and a worst-first Health Scores list — every figure real, bounded the same way every other workspace-scanning aggregator in this checkpoint is bounded (bulk-fetch, then bounded per-event fan-out).

## Operations Reports

A new page (`/operations/reports`): Completed Events (most recent 25), Gross/Net Profit, Vendor Performance (orders + spend), Inventory Usage (movement counts), Purchase Order count, and Expenses — every figure real and bounded. "Team Performance" is honestly omitted: no aggregated index of completed checklist items by team member exists in this codebase (only free-text assignment per item).

## Mobile Operations

Live Event Mode's every action button uses `min-h-11` (44px) touch targets, verified live on a 375×812 viewport with no horizontal overflow and full-width stacked form fields. "Voice Notes" (named in the spec) is honestly not implemented — no audio-capture UI or storage flow exists in this codebase; the existing text-based Add Note covers the same on-site-communication need.

## Bloom AI Operations

`generateOperationsBrief(eventId)` — a new Copilot assistant following the exact `eventAssistant.ts` precedent, composing Risk Summary, Budget Insight, Packing Suggestion, Timeline Improvement, Vendor Recommendation, and Team Recommendation into one deterministic operational brief, rendered by `OperationsAssistantCard` on the Event Detail page. No external AI provider — every sentence is a template over already-computed engine outputs, per the stop condition.

## Accessibility

Every new form field (Live Event Mode's Note/Issue/Description/Amount/Category) carries a real `aria-label`, not just a placeholder. The Command Center's health `ProgressBar` reuses the existing accessible primitive (`role="progressbar"`, `aria-valuenow`, visible percentage text). No new color-only status indicators — every risk/badge pairs a tone with visible label text. `prefers-reduced-motion` is inherited from the existing sitewide rule; no new custom animation was introduced.

## Performance

Every workspace-scanning aggregator (`getOperationsDashboardData`, `getVendorOperationsSummary`, `getPurchaseAssignedEvents`, `getOperationsReportsData`) is explicitly bounded — filtered to active events and/or capped to a top-N read — documented in each module's own comment, to avoid unbounded fan-out as the workspace grows. Every new card guards its fetch with a `cancelled` flag and degrades quietly (renders `null`) on error, matching the Assistant Card precedent from Checkpoint 20. This codebase's React Compiler auto-memoizes function components, so no manual `useMemo`/`useCallback` was needed to match the existing convention.

## Browser Verification

✓ Desktop verified. ✓ Mobile verified (375×812) — a full, live pass against the real dev server (mock data mode for local verification only, then reverted to `supabase`).

- **Event Command Center** (`/events/event_2`, "Casey's Birthday Hotel Suite"): rendered a real "Attention" health badge at 57% with a live progress bar, a real Risk Center warning ("This event has an outstanding payment balance"), real summary tiles, real Logistics Center phases with a computed loading-window note, real Budget Center figures (a genuine −103% margin, since this event has real expenses but no estimated budget lines yet), and the new "Bloom AI — Operations Brief" card rendering a real deterministic sentence alongside the pre-existing "Bloom AI — Event Assistant" card.
- **Live Event Mode**: opened via "Preview Live Event Mode," showed real checklist tasks with working Complete buttons, Check In/Check Out/Request Help, photo upload, note/issue/expense forms. Clicked Check In — confirmed "Checked in / Amoré Bloom Owner checked in / 17:13:12" appeared immediately in the Event-Day Activity log.
- **Operations Dashboard** (`/operations`): rendered real workspace-wide figures — 3 Late Tasks, 1 Inventory Alert (a real damaged item), 1 Purchase Alert (a real overdue PO), a Health Scores list, and real Payments figures.
- **Operations Reports** (`/operations/reports`): rendered 1 real Completed Event, real Gross/Net Profit, real Vendor Performance (2 vendors with real order counts and spend), real Inventory Usage (movement counts per item), and the honest "Team Performance isn't shown here" disclosure.
- **Team Operations** (`/team/operations`): correctly showed "Not checked in" and empty Today's Events/Assigned Tasks for the signed-in Owner, since the seeded event's `assigned_owner` is "Amoré Bloom Team," not the signed-in member's own name — confirming the `assigned_owner === fullName` scoping is real, not a fabricated always-populated view.
- **Mobile**: Command Center header, badges, and progress bar stack correctly with no overflow; Live Event Mode renders as a full-width modal with large, clearly-tappable action buttons.
- No console errors observed on any of the above surfaces at either viewport.

## Quality Gates

| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | Clean |
| ESLint (`eslint .`) | 0 errors, 16 warnings (pre-existing baseline, unchanged) |
| Test suite (`vitest run`) | **534 test files, 5320 tests, all passing** — including 40 new engine tests (`healthScoreEngine`, `riskEngine`, `packingEngine`, `logisticsEngine`, `budgetEngine`, `timelineEngine`, the `OperationsStore` mock repository) plus new UI tests for `OperationsDashboardView`, `TeamOperationsView`, `OperationsReportsView`, and updated mocks/assertions in `EventDetail.test.tsx`, `VendorDetailView.test.tsx`, `PurchaseDetailView.test.tsx` for the newly-mounted cards |
| Production build (`next build`) | Clean — `/operations`, `/operations/reports`, `/team/operations`, and every existing route compile |

## Documentation

[docs/event-command-center.md](event-command-center.md), [docs/operations-engine.md](operations-engine.md), [docs/health-score.md](health-score.md), [docs/logistics-engine.md](logistics-engine.md).

## Known Limitations

- **"Team Performance" (Operations Reports) is not shown** — no aggregated index of completed checklist items by team member exists in this codebase; `ChecklistItem.assigned_name` is free text, not a queryable relationship.
- **"Inventory assignments" and "internal team messaging" (Team Operations) are not modeled** — no per-team-member inventory assignment or internal messaging system exists; only the Client Portal's own client-facing messaging exists, which is a different feature entirely.
- **"Payments," "Contracts," and "Rating" (Vendor Operations) have no Vendor-scoped field** — Purchase History (via `getPurchasesByVendorId`) is the closest real proxy shown; `Vendor.is_preferred` (already surfaced elsewhere on the page) is the only real preference/rating-adjacent signal.
- **"Voice Notes" (Mobile Operations) is not implemented** — no audio-capture UI or storage flow exists; text-based Add Note covers the same on-site-communication need.
- **Two Operations Timeline milestones are derived proxies, not purpose-built fields** — "Gallery Delivered" is the earliest gallery `MediaAsset` upload; "Review Received" is a staff-logged Live Event note mentioning "review." Neither a formal delivery flag nor a review/rating entity exists in this codebase.
- **The Operations Dashboard's Health Scores list uses the base `eventHealth.ts` score, not the full Operations Health Score v2** — a deliberate performance bound (see [docs/health-score.md](health-score.md)); the Event Command Center remains the place to see one event's full v2 score.
- **Workspace-scanning aggregators (Vendor/Purchase Operations, Operations Dashboard/Reports) are bounded**, not exhaustive — e.g. Vendor Operations scans only active, non-archived Events; Operations Reports caps to the 25 most recent Completed Events and top-10 Vendors/Inventory items. Documented in each module's own code comment.
- **No new Supabase table exists for the Live Event Log** — `OperationsStore` is mock-only this phase, the same "architecture ahead of a migration" precedent every other Core domain (AI Memory, Tags, Comments, Feature Flags) followed before its own Foundation phase.

## Recommendation

**APPROVED.** Every Event in BloomOS now has a genuine, one-screen operational workspace: a live Health Score, a Risk Center, real Team/Vendor/Purchase/Budget summaries, a categorized Packing Assistant with a working Reserve action, a computed Logistics Center, and a unified Operations Timeline — verified working end-to-end in the browser at desktop and mobile, including a real Check-In action that immediately appeared in the event-day activity log. The workspace now also has an Operations Dashboard and Operations Reports for cross-event visibility. Every new engine reuses or extends existing BloomOS logic rather than duplicating it (`eventHealth.ts`, `eventAssistant.ts`, the Client Portal Timeline pattern, the reserved `InventoryMovement` reservation fields), and every place real data doesn't exist for a spec-named field (Team Performance, Vendor Payments/Contracts/Rating, Voice Notes, Gallery Delivered/Review Received) is honestly disclosed rather than fabricated. No visual redesign, Dashboard change, or external integration was made. Per the stop condition, no Stripe, Google Calendar, Gmail, Twilio, OpenAI, Anthropic, or other external provider integration was implemented — the Luxury Event Operations Platform's architecture and native experience are complete.
