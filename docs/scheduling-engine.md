# Scheduling Engine — Architecture

v2.0 Checkpoint 27 — Enterprise Scheduling Platform. Scheduling determines **WHEN** work can happen. It never determines **WHO** should perform it (Checkpoint 26.1's Capability Platform already answers that) or **WHO** is actually sent (a future Dispatch Platform's job). Every engine here is a pure, deterministic function — no AI, no randomness.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/scheduling.ts` | — |
| Mock stores (8) | `lib/data/mock/{calendars,appointments,reservations,calendarWindows,workingHours,recurrenceRules,capacityRules,holidays}Store.ts` | — |
| Accessors | `core/scheduling/index.ts` | — |
| WorkingHoursEngine | `core/scheduling/workingHoursEngine.ts` | [`working-hours.md`](working-hours.md) |
| HolidayEngine | `core/scheduling/holidayEngine.ts` | [`holiday-engine.md`](holiday-engine.md) |
| RecurrenceEngine | `core/scheduling/recurrenceEngine.ts` | [`recurrence-engine.md`](recurrence-engine.md) |
| AvailabilityWindowEngine / CalendarEngine | `core/scheduling/{availabilityWindowEngine,calendarEngine}.ts` | [`calendar.md`](calendar.md) |
| BufferEngine | `core/scheduling/bufferEngine.ts` | [`buffer-engine.md`](buffer-engine.md) |
| ReservationEngine | `core/scheduling/reservationEngine.ts` | [`reservation-engine.md`](reservation-engine.md) |
| CapacityEngine | `core/scheduling/capacityEngine.ts` | [`capacity-engine.md`](capacity-engine.md) |
| ConflictEngine | `core/scheduling/conflictEngine.ts` | [`conflict-engine.md`](conflict-engine.md) |
| ScheduleValidationEngine | `core/scheduling/scheduleValidationEngine.ts` | Below |
| SchedulingScoreEngine | `core/scheduling/schedulingScoreEngine.ts` | Below |
| SchedulingTimelineEngine | `core/scheduling/schedulingTimelineEngine.ts` | Below |
| SchedulingKnowledgeGraphEngine | `core/scheduling/schedulingKnowledgeGraphEngine.ts` | Below |
| SchedulingRiskEngine / SchedulingFindingsEngine | `core/scheduling/{schedulingRiskEngine,schedulingFindingsEngine}.ts` | Below |
| Shared timezone resolution | `core/scheduling/timeZoneUtils.ts` | Below |
| Module layer | `modules/scheduling/schedulingActions.ts` | Below |
| Dashboards | `/calendar`, `/calendar/[id]` | [`calendar-dashboard.md`](calendar-dashboard.md) |

## Schedule Validation Engine

The single "can this appointment actually be saved" gate — structural field checks (title required, `ends_at > starts_at`, non-negative buffers) plus every `ConflictEngine` finding, reduced to `valid`/`errors`/`warnings`:

```ts
validateAppointmentSchedule(title, conflictInput): ScheduleValidationResult
```

A `"high"`-severity conflict always blocks (`errors`); a `"medium"`-severity one (buffer/timezone) is surfaced but never blocks (`warnings`) — a caller can still save, just sees the heads-up.

## Scheduling Score Engine

Six scores, **schedule quality only** — no worker ever factors in, per the stop condition:

| Score | Formula |
|---|---|
| `windowQualityScore` | 100 × (1 − window-issue count ÷ appointment count) |
| `bufferQualityScore` | 100 × (1 − buffer-conflict count ÷ appointment count) |
| `capacityUtilizationScore` | 100 × (checks within capacity ÷ total checks) |
| `conflictSeverityScore` | 100 − Σ(15 per `high` conflict + 5 per `medium`) |
| `scheduleDensityScore` | 100 × (booked minutes ÷ available working-hours minutes) |
| `calendarHealthScore` | Unweighted average of the other five |

Every "not applicable" case (zero appointments, zero capacity rules) resolves to a vacuous **100**, never a fabricated 0 — the same discipline `capabilityScoreEngine.ts` established. `scheduleDensityScore` alone is descriptive, not a "goodness" score — it can legitimately exceed 100% of a healthy range without being wrong.

## Scheduling Timeline Engine — the 9 named events

`appointment_created/updated/cancelled`, `reservation_created/confirmed/expired`, `scheduling_conflict_detected/resolved`, `calendar_updated`. Pure `{ type, description }` builders; `schedulingActions.ts` calls them only on a real transition, never on every read.

**Disclosed gap:** `scheduling_conflict_detected`/`scheduling_conflict_resolved` are registered in `TimelineActivityType` but not yet emitted by `schedulingActions.ts` — conflicts are surfaced synchronously (a create/update is simply rejected, or a re-evaluation's finding count changes), and there was no natural "this exact conflict transitioned" moment to hook without inventing one. A future Dispatch checkpoint, which will genuinely resolve conflicts by reassigning work, is the natural place to wire `scheduling_conflict_resolved`.

## Scheduling Knowledge Graph Engine — 4 live relationships, 2 reserved

`scheduled_for` (worker → appointment's context node), `reserved_for` (reservation's own resource node → linked appointment's context node), `conflicts_with` (earlier appointment's context node → later one's, deterministic direction), `belongs_to_calendar` (appointment's context node → calendar's context node) are all real, persisted via `schedulingActions.ts`. `blocks` and `occurs_during` are registered in `RelationshipType` but never emitted — `CalendarWindow`/`Holiday` have no node identity of their own, the same disclosed-gap discipline `types/capability.ts` established for `requires_skill`. A `"asset"`-type `Reservation` never produces `reserved_for` either — Checkpoint 25's DAM uses `"media_asset"`, a distinct node type; there is no `"asset"` `KnowledgeNodeType`.

## Scheduling Risk Engine / Findings Engine — Executive Integration

`detectSchedulingRisks()` runs 7 named, deterministic detectors (Overbooked Schedule, Unavailable Time Window, Capacity Exhausted, Recurring Conflict, Holiday Conflict, Reservation Expiration, Calendar Health) over already-computed data. `schedulingFindingsToRecommendations()` translates the result into the Executive Decision Platform's existing `OperationalRecommendation` shape — the same "translate, don't duplicate" discipline `capabilityFindingsEngine.ts` established. Wired into `executiveDecisionsActions.ts`'s `recommendationSources` as one more contributor (`generatedBy: "scheduling_engine"`), wrapped so a scheduling evaluation failure never blocks the rest of Executive Decision evaluation.

## Shared timezone resolution

`resolveLocalDateTime(iso, timeZone)` uses `Intl.DateTimeFormat` — correct IANA conversion, zero dependencies — to turn a true UTC instant into local `{ localDate, dayOfWeek, localTime }`. Every engine that needs to compare a real instant against `WorkingHoursRule`'s genuinely-local `HH:mm` goes through this one function; no engine does its own timezone math.
