# Event Command Center (v2 Checkpoint 21)

Every Event's own one-screen operational hub — Countdown, Health Score v2, Risk Center, Team/Vendor/Purchase/Budget/Inventory summaries, the Packing Assistant, the Logistics Center, and the unified Operations Timeline. Mounted on `EventDetailView.tsx` (`/events/[id]`), in place of the old "Future Integrations — reserved for upcoming modules" placeholder card.

## Why here, not a new route

The spec's own success criterion is "a single event should become a complete operational workspace" — the natural home for that is the Event's own existing detail page, not a second competing surface. The Command Center is additive: every pre-existing card on `/events/[id]` (Event Summary, Client, Date & Time, Location, Health, Financial Summary, Checklist, Schedule, Contracts, Assigned Services, Documents, Timeline, Notes) is untouched. Only the literal "Future Integrations" stub — which already said "Team assignments / Vendors / Inventory" were not built yet — was replaced with the real thing.

## Data flow

```
EventCommandCenter.tsx (Client Component)
   │
   ▼
getEventOperationsData(eventId)   — modules/operations/eventOperationsData.ts
   │
   ├─ fetches (parallel): event, client, checklist, schedule, contracts,
   │  financial summary, assigned services, low-stock items, workspace
   │  members, vendors, payments, expenses, gallery assets, live event log,
   │  latest proposal, overdue purchases
   │
   ├─ fetches (parallel, second stage — depends on assigned services):
   │  inventory requirements, purchase requirements, budget lines, team
   │  requirements, vendor assignments — per assigned Service
   │
   ├─ fetches (parallel, third stage — depends on matched inventory items):
   │  each matched InventoryItem + its movement history
   │
   ▼
Reusable Engines (core/operations/) — see docs/operations-engine.md
   │
   ▼
EventOperationsData — one object the UI renders directly
```

`getEventOperationsData` is a plain client-callable function, not a `"use server"` action — the same reasoning as every Bloom AI Copilot data function from Checkpoint 20: `@/lib/data` resolves to the browser-bound Supabase client in `"supabase"` data mode, so calling it from inside a real Server Action would throw.

## What's on screen

- **Countdown** — days until the event, or days since if past.
- **Health Score v2** — a `Badge` (Excellent/Good/Attention/Critical) plus a `ProgressBar` showing the 0–100 score. See [health-score.md](health-score.md).
- **Risk Center** — every triggered `OperationsRisk`, critical first, each with a message and a recommendation.
- **Summary tiles** — Checklist %, Team assigned/total, Vendors confirmed/total, Purchases fulfilled/total, Budget margin %, Gallery asset count.
- **Team Assignments / Vendor Assignments** — real `EventServiceTeamRequirement`/`EventServiceVendorAssignment` rows, resolved against `TeamMember`/`Vendor`.
- **Packing Assistant** — categorized packing list with a **Reserve** quick-action per inventory-backed item (see [operations-engine.md](operations-engine.md)'s Inventory Operations section).
- **Logistics Center** — real schedule items grouped into the 6 named phases, with computed travel buffers and loading/unloading notes.
- **Budget Center** — estimated vs. actual revenue/cost/profit/margin, and a forecast note.
- **Operations Timeline** — the unified milestone feed. See [operations-engine.md](operations-engine.md).
- **Weather** — the Event's own real `weather_plan` field, honestly labeled when absent (no connected weather API).
- **Live Event Mode** — a button that opens the event-day action panel (Check In/Out, Complete Tasks, Upload Photos/Videos, Add Note, Report Issue, Register Expense, Request Help). Labeled "Open Live Event Mode" when `lifecycle_stage` is `setup`/`execution`/`live_event`/`breakdown`, "Preview Live Event Mode" otherwise — the same panel either way, since a manager reviewing an upcoming event's readiness should be able to see it too.

Two Bloom AI Copilot cards are mounted alongside the Command Center on the same page: the pre-existing `EventAssistantCard` (Checkpoint 20 — packing/shopping split, suggested vendors/team, weather reminder, luxury tips) and the new `OperationsAssistantCard` (Checkpoint 21 — a deterministic operational brief; see [operations-engine.md](operations-engine.md)'s Bloom AI Operations section).

## Live Event Mode

`LiveEventModePanel.tsx` — every action reuses a real BloomOS entity rather than inventing one:

| Action | Backed by |
|---|---|
| Complete Tasks | `completeChecklistItem` (real `ChecklistItem`) |
| Upload Photos/Videos | `uploadMediaAsset` (real `MediaAsset`, `owner_type: "event"`) |
| Add Note | `createEventNote` (real `Note`) |
| Register Expense | `createExpense` (real `Expense`, `event_id` set) |
| Check In / Check Out / Report Issue / Request Help | `logLiveEventEntry` — the new `OperationsStore` (see below) |

Only the last four have no existing BloomOS entity to reuse — see `types/liveEventLogEntry.ts` for why. Every write here feeds the Operations Timeline on the Command Center's next load.

## Reserve for this event

The Packing Assistant's "Pull from stock" items each get a **Reserve** button that calls `recordInventoryMovement(itemId, { movement_type: "reservation", reference_type: "event", reference_id: eventId })` — the first real caller of the `reservation`/`event_checkout`/`event_return` movement types and the `reference_type`/`reference_id` fields, which existed in this codebase's `InventoryMovement` type since the Inventory Foundation phase but were explicitly documented as "reserved... not populated by anything this phase" until now.

## Known scope decisions

- **Bounded fan-out**: fetching per-Service data (inventory/purchase/team/vendor requirements) means one Promise.all per assigned Service — reasonable for one Event's own Services, never workspace-wide.
- **No new UI redesign**: every existing card, badge, and layout convention on `/events/[id]` is reused as-is (`Card`, `Badge`, `Button`, `Skeleton`, `ErrorState`, `ProgressBar`) — no new design tokens, no new component library additions.
