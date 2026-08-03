# Operations Engine (v2 Checkpoint 21, Step 17)

The reusable, pure, independently-testable services behind the entire Luxury Event Operations Platform. Every one lives under `src/core/operations/`, takes already-fetched data as input, and performs no I/O itself — matching the precedent `core/workflows/eventHealth.ts` and `modules/finance/financialSummary.ts` already set in earlier checkpoints.

## Module layout

```
core/operations/
  types.ts               — shared types (bands, risks, packing categories, logistics phases, budget, timeline milestones)
  healthScoreEngine.ts    — HealthScoreEngine
  riskEngine.ts           — RiskEngine
  packingEngine.ts        — PackingEngine
  logisticsEngine.ts      — LogisticsEngine
  budgetEngine.ts         — BudgetEngine
  timelineEngine.ts       — TimelineEngine
  operationsStore.ts      — OperationsStore (the one stateful piece — Live Event Mode's own log)

lib/data/operations/
  repository.ts           — LiveEventLogRepository interface
  mockRepository.ts       — mock-only implementation (no Supabase table yet)

modules/operations/
  eventOperationsData.ts       — Event Command Center's data-assembly seam (Step 1)
  operationsDashboardData.ts   — workspace-wide Operations Dashboard seam (Step 13)
  teamOperationsData.ts        — Team Operations seam (Step 6)
  vendorOperationsData.ts      — Vendor Operations seam (Step 7)
  purchaseOperationsData.ts    — Purchase Center seam (Step 8)
  operationsReportsData.ts     — Operations Reports seam (Step 16)
```

## HealthScoreEngine ([health-score.md](health-score.md))

`getOperationsHealth(context): { score, band, factors }`. Extends — never forks — `core/workflows/eventHealth.ts`'s existing 8-factor deduction model with 10 new operational factors (financial, inventory, vendors, team, purchases, timeline, documents, budget), then classifies the combined score into the spec's own four bands (Excellent ≥90 / Good ≥70 / Attention ≥45 / Critical <45).

## RiskEngine

`detectOperationsRisks(input): OperationsRisk[]`. A small, explicitly extensible list of 8 pure detector functions (`RISK_DETECTORS`), one per required risk kind (`missing_team`, `late_vendor`, `low_inventory`, `pending_payment`, `missing_contract`, `budget_overrun`, `late_purchase`, `missing_checklist`). Each detector reuses a signal the caller already computed — never a new fact — and returns `null` or one `OperationsRisk` (`{ kind, severity, message, recommendation }`). Adding a 9th risk kind means appending a detector to the array, never editing the ones already there. Same "small registered detector list" precedent as the Event Operations Brief's own `riskEngine.ts` from Checkpoint 2.

## PackingEngine

`buildPackingList(requirements, inventoryItemsById): PackingListItem[]` and `classifyPackingCategory(itemName, inventoryItem): PackingCategory`. Extends the packing/shopping split `eventAssistant.ts` (Checkpoint 20) already derives from `EventServiceInventoryRequirement.inventory_item_id`, adding categorization into the spec's own 10 named buckets (Decoration, Flowers, Candles, Balloons, Furniture, Tools, Extension Cords, Lighting, Vehicle Requirements, Safety Items) via a fixed keyword table matched against the item's own real `category`/`subcategory`/`tags`/name text. Every item comes from a real requirement row — only the classification *rule* is a curated mapping, the same kind of fixed-but-generic table `EXPENSE_CATEGORY_LABELS`/`SCHEDULE_CATEGORY_LABELS` already use elsewhere.

## LogisticsEngine

`buildLogisticsPlan(schedule): LogisticsPlan`. The Logistics Center turned out to be "nearly free": `EventScheduleItem.category` (`ScheduleCategory`) already covers arrival/setup/ceremony/photography/cleanup/departure — this engine is a grouped, time-ordered view over the Event's own real schedule, never a new schedule model. Travel buffers are the real time gap (in minutes) between consecutive schedule items; Loading/Unloading notes are derived from the Arrival/Departure items' own real times, honestly reporting "not found" rather than fabricating a time when neither exists.

## BudgetEngine

`buildOperationsBudget(budgetLines, financialSummary): OperationsBudget` and `isOverBudget(budget): boolean`. One of the few genuinely new aggregations this checkpoint needed — per research, no cross-Event finance aggregate existed, and per-Event *estimated* budget didn't exist before `EventServiceBudgetLine` (generated at Service-assignment time). Estimated figures sum real `EventServiceBudgetLine` rows (forward-looking, never touches ledger data); actual figures reuse `EventFinancialSummary` (Checkpoint 8's own ledger-derived numbers) untouched — this engine only combines the two.

## TimelineEngine ([Operations Timeline](#operations-timeline))

`buildOperationsTimeline(input): OperationsTimelineEntry[]`. See below.

## OperationsStore

Persistence for Live Event Mode's own log entries (Check In/Out, Report Issue, Request Help, and a generic note) — mock-only this phase, same "architecture ahead of a Supabase migration" precedent as `core/ai/memory`'s Knowledge Store before it had a real table. `logLiveEventEntry`/`getLiveEventLog` are the two functions everything else calls; the underlying `LiveEventLogRepository` interface exists so a real Supabase-backed implementation is a drop-in swap later, exactly like every other domain in this codebase.

## Operations Timeline

The "unified timeline" (Step 3) is a staff-facing aggregator following the exact pattern the Client Portal's own `aggregateClientPortalTimeline` (Checkpoint 14) already established: a pure function over already-fetched arrays, sorted into one feed. Deliberately a *separate* aggregator from `ClientPortalTimelineEntry` — that type's 6 kinds are client-safe and intentionally limited; this one surfaces internal-only milestones (inventory reservations, vendor/team assignment, live-event-day check-ins) a client should never see.

Every milestone kind maps to a real record:

| Milestone | Source |
|---|---|
| Proposal Created | The Event's latest `ProposalDraft` (`getLatestProposalForEvent`) |
| Deposit Paid | A `Payment` with `payment_type: "deposit"`, `status: "succeeded"` |
| Flowers Ordered | An `Expense` with `category: "flowers"` |
| Inventory Reserved | An `InventoryMovement` with `movement_type: "reservation"`/`"event_checkout"`, scoped by `reference_type: "event"` |
| Vendor Assigned | An `EventServiceVendorAssignment` with `status: "confirmed"` |
| Team Assigned | An `EventServiceTeamRequirement` with `assigned_member_id` set |
| Setup Started | A schedule item, `category: "setup"`, `status: "completed"` |
| Client Arrived | A Live Event Log `check_in` entry whose note mentions "client" |
| Event Completed | `Event.completed_at` |
| Gallery Delivered | The earliest gallery `MediaAsset` upload for the event |
| Review Received | A Live Event Log note mentioning "review" |

**Honesty note**: two milestones (Gallery Delivered, Review Received) have no dedicated "delivered"/"review" field anywhere in this codebase — they're derived from the closest real proxy available (first gallery upload; a staff-logged note) rather than a purpose-built field, and that's documented here rather than silently overstated.

## Bloom AI Operations

`modules/ai/copilot/assistants/operationsAssistant.ts` — `generateOperationsBrief(eventId)`. The Copilot's own per-event operational brief, following the exact `eventAssistant.ts` (Checkpoint 20) precedent for per-Event Copilot cards. Every sentence is a deterministic template over `getEventOperationsData()`'s own already-computed engine outputs — never a new computation, and never a real generative AI call, per this checkpoint's stop condition. Rendered by `OperationsAssistantCard.tsx`, mounted on `EventDetailView.tsx` next to the existing `EventAssistantCard`.

## Reuse ledger

| New engine | Wraps / extends |
|---|---|
| HealthScoreEngine | `core/workflows/eventHealth.ts` |
| PackingEngine | `eventAssistant.ts`'s packing/shopping split |
| LogisticsEngine | `EventScheduleItem`/`ScheduleCategory` |
| BudgetEngine | `EventServiceBudgetLine` + `EventFinancialSummary` |
| TimelineEngine | The Client Portal Timeline's own aggregator pattern |
| RiskEngine | The Event Operations Brief's own detector-list pattern |
| Reserve action | `recordInventoryMovement`'s reserved `reservation`/`reference_type` plumbing |
