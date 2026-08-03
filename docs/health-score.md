# Event Health Score v2 (v2 Checkpoint 21, Step 11)

## What changed from Checkpoint 19

`core/workflows/eventHealth.ts` (built in Checkpoint 19) is a deduction-based 0–100 score over 8 factors — checklist presence/overdue, schedule presence, location, budget, contract/deposit status, priority, approaching-date readiness, post-event review. It's still used exactly as before: by `EventDetailView.tsx`'s own `EventHealthCard` (the "Event Health" sidebar card) and by `EventOperationsBriefSection`'s context builder. **Nothing about it changed.**

`core/operations/healthScoreEngine.ts`'s `getOperationsHealth()` is new, additive, and **extends** it rather than forking it: it calls `getEventHealthDetails()` internally to get the base 8 factors, then adds 10 more operational factors on the same 0–100 scale, then classifies the *combined* score into a different set of bands.

## Why two health scores coexist

They serve different audiences and have different classification schemes by design:

| | `eventHealth.ts` (Checkpoint 19) | `healthScoreEngine.ts` (Checkpoint 21) |
|---|---|---|
| Audience | One Event's own detail page — "is this Event on track" | Staff-wide operational triage — the Command Center, the Operations Dashboard |
| Classification | Ready / Waiting / Blocked (a Kanban badge) | Excellent / Good / Attention / Critical (the spec's own 4 bands) |
| Factors | 8 (checklist, schedule, location, budget, contract, deposit, priority, date, review) | The same 8, **plus** 10 more (financial, inventory, vendor, team, purchase, timeline, documents, budget) |
| Where shown | `EventHealthCard` sidebar card, Operational Pipeline Kanban badges | Event Command Center, Operations Dashboard's "Health Scores" list |

Forking the deduction logic would have meant maintaining two independent lists of "what counts as unhealthy" that could silently drift apart. Instead, `getOperationsHealth()`'s base factors are *literally* `eventHealth.ts`'s own output, re-labeled with `domain: "checklist"` — if a future checkpoint changes a base deduction, both scores update together automatically.

## The 10 new operational factors

| Factor | Deduction | Domain | Triggered when |
|---|---|---|---|
| Outstanding payment balance | 12 | financial | `outstandingBalanceMinor > 0` |
| Overdue invoice | 18 | financial | An invoice is overdue |
| Assigned inventory low in stock | 10 | inventory | A packing-list item pulled from stock is workspace-wide low-stock |
| Items still need sourcing | 8 | inventory | Any packing-list item has no matched inventory (shopping list) |
| Vendor requirement not yet assigned | 10 | vendors | A vendor assignment isn't `confirmed` |
| Team role not yet assigned | 12 | team | A team requirement has no `assigned_member_id` |
| Purchase order overdue for delivery | 10 | purchases | A linked Purchase appears in `getOverduePurchases()` |
| Actual cost exceeds estimated budget | 15 | budget | `BudgetEngine.isOverBudget()` |
| No recorded activity in 14+ days | 6 | timeline | No Event/checklist/schedule `updated_at` within 14 days |
| No documents on file | 8 | documents | Zero contracts on the Event |

Every factor is independent and compounds — multiple gaps deduct together, floored at 0, same as the base engine.

## Bands

```
score >= 90  → Excellent
score >= 70  → Good
score >= 45  → Attention
score <  45  → Critical
```

Thresholds were chosen so that a single major operational gap (a 12–18-point deduction) drops a perfect score into "Good," two compounding gaps drop it to "Attention," and three or more (or one severe one, like a budget overrun) drop it to "Critical" — deliberately more forgiving at the top than `eventHealth.ts`'s own all-or-nothing "Ready" (which requires a perfect 100).

## Where it's displayed

- **Event Command Center** — a `Badge` with the band label, plus a `ProgressBar` showing the numeric score, at the top of the card.
- **Operations Dashboard** — a "Health Scores — Upcoming Events" list, one row per event in the next 14 days, sorted worst-first. This list uses `eventHealth.ts`'s **base** score only (not the full v2), for a deliberate performance reason — see "Scope decision" below.
- **Bloom AI Operations Brief** (`OperationsAssistantCard`) — the opening sentence of the deterministic brief ("This event is currently Attention (57/100)...").

## Scope decision: why the Operations Dashboard uses the base score, not v2

Computing the full Operations Health Score for every upcoming event workspace-wide would mean the full per-event fan-out (financial summary, inventory lookups, vendor/team requirement scans, purchase overdue checks) repeated once per event on a single dashboard load — unbounded and slow as the workspace grows. The Operations Dashboard instead uses `eventHealth.ts`'s cheap base score (checklist/schedule/location/budget/contract/deposit/priority/date/review only) for breadth. The Event Command Center remains the one place to see a single event's full Operations Health Score v2, where the fan-out cost is bounded to exactly one event.
