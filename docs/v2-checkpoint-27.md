# v2.0 Checkpoint 27 — Enterprise Scheduling Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Checkpoint 27 answers a question neither Checkpoint 26 (Workforce Foundation) nor 26.1 (Capability & Eligibility) ever asked: given a calendar, when can work actually happen? Scheduling determines **WHEN** — it never determines **WHO** should perform the work (Capability already solved that) or **WHO** is actually sent (a future Dispatch Platform's job). Every engine here is a pure, deterministic function over already-computed data — no AI, no randomness, no worker selection anywhere.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/scheduling.ts` | Calendar, Appointment, Reservation, CalendarWindow, WorkingHoursRule, RecurrenceRule, CapacityRule, Holiday, plus 6 computed-only result shapes |
| 8 mock stores | `lib/data/mock/*.ts` | See [`scheduling-engine.md`](scheduling-engine.md)'s module map |
| WorkingHoursEngine / HolidayEngine | `core/scheduling/{workingHoursEngine,holidayEngine}.ts` | [`working-hours.md`](working-hours.md) / [`holiday-engine.md`](holiday-engine.md) |
| RecurrenceEngine | `core/scheduling/recurrenceEngine.ts` | [`recurrence-engine.md`](recurrence-engine.md) |
| AvailabilityWindowEngine / CalendarEngine | `core/scheduling/{availabilityWindowEngine,calendarEngine}.ts` | [`calendar.md`](calendar.md) |
| BufferEngine / ReservationEngine | `core/scheduling/{bufferEngine,reservationEngine}.ts` | [`buffer-engine.md`](buffer-engine.md) / [`reservation-engine.md`](reservation-engine.md) |
| CapacityEngine | `core/scheduling/capacityEngine.ts` | [`capacity-engine.md`](capacity-engine.md) |
| ConflictEngine | `core/scheduling/conflictEngine.ts` | [`conflict-engine.md`](conflict-engine.md) — 10 named conflict types |
| ScheduleValidationEngine / SchedulingScoreEngine | `core/scheduling/{scheduleValidationEngine,schedulingScoreEngine}.ts` | [`scheduling-engine.md`](scheduling-engine.md) |
| SchedulingTimelineEngine | `core/scheduling/schedulingTimelineEngine.ts` | 9 named Timeline events |
| SchedulingKnowledgeGraphEngine | `core/scheduling/schedulingKnowledgeGraphEngine.ts` | 4 live relationships, 2 reserved |
| SchedulingRiskEngine / SchedulingFindingsEngine | `core/scheduling/{schedulingRiskEngine,schedulingFindingsEngine}.ts` | 7 named findings → Executive Decisions |
| Module layer | `modules/scheduling/schedulingActions.ts` | Full CRUD + validation + conflict rejection + `evaluateWorkspaceSchedulingAction` |
| Dashboards | `/calendar`, `/calendar/[id]` | [`calendar-dashboard.md`](calendar-dashboard.md) |

## Reuse, honored exactly as the stop condition requires

- **Capability, Workforce, Knowledge Graph, Executive Decisions, Operational Intelligence** — never duplicated. `Appointment.worker_id` is set only when a caller has already decided WHO via Checkpoint 26.1's Capability Platform (or a future Dispatch Platform); this checkpoint never selects, assigns, or dispatches a worker anywhere.
- **`EventScheduleItem`** (pre-existing, a per-Event day-of itinerary entry) is a genuinely distinct concept from this checkpoint's `Appointment`/`Calendar` — confirmed no Timeline event-name collision, no shared store.
- **Knowledge Graph** — reuses the single existing `RelationshipType` system; `scheduled_for`/`reserved_for`/`conflicts_with`/`belongs_to_calendar` are new *values* in that one closed list, never a second relationship mechanism.
- **Timeline** — every lifecycle transition records through the same `recordTimelineActivity` every checkpoint uses.
- **Executive Decisions** — `schedulingFindingsToRecommendations()` translates `SchedulingFinding[]` into the existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "scheduling_engine"`), wrapped so a scheduling evaluation failure never blocks the rest of Executive Decision evaluation — confirmed by the full pre-existing Executive Decisions test suite still passing unchanged.
- **Permissions** — `scheduling.view`/`scheduling.manage` follow the exact `assets.view`/`assets.manage` narrower-manage/broader-view precedent, collapsing the spec's 8 named capabilities into 2 permissions; `scheduling.manage` is granted to owner/manager, `scheduling.view` additionally to staff.
- **No AI, no randomness anywhere** — every score and risk detection is a disclosed arithmetic formula or deterministic comparison.

## Real bugs this checkpoint's own test suite caught before shipping

1. **`holidayEngine.listHolidaysInRange`** originally returned a recurring holiday's original stored `Holiday` row unchanged for every matched year, so a Calendar Dashboard querying 2028 would have shown "2026-01-01" instead of "2028-01-01." Caught by `holidayEngine.test.ts`'s first run; fixed by returning `HolidayOccurrence[]` (`{ holiday, date }`) with `date` set to the actually-matched year. See [`holiday-engine.md`](holiday-engine.md).
2. **`calendarsStore.setCalendarStatus`** originally preserved the old `archived_at` timestamp when reactivating a calendar (`status: "active"` but `archived_at` still non-null — a nonsensical state). Caught by `calendarsStore.test.ts`'s reactivation test; fixed to clear `archived_at` to `null` on any transition away from `"archived"`.

Both are disclosed here rather than silently fixed, per this session's own discipline of surfacing what testing actually caught.

## Known limitations (disclosed, not hidden)

1. **`scheduling_conflict_detected`/`scheduling_conflict_resolved` are registered but never emitted.** Conflicts are surfaced synchronously — a create/update is simply rejected by `ScheduleValidationEngine`, or a re-evaluation's finding count changes — and there was no natural "this exact conflict transitioned" moment to hook without inventing one. A future Dispatch checkpoint, which will genuinely resolve conflicts by reassigning work, is the natural place to wire `scheduling_conflict_resolved`.
2. **`blocks`/`occurs_during` relationship types are reserved vocabulary, not live edges.** `CalendarWindow`/`Holiday` have no node identity of their own — the same disclosed-gap discipline `types/capability.ts` established for `requires_skill`/`requires_certification`/`requires_language`.
3. **An `"asset"`-type `Reservation` never produces a `reserved_for` edge.** There is no `"asset"` `KnowledgeNodeType` — Checkpoint 25's DAM uses `"media_asset"`, a distinct concept — so this is a genuine type-safety constraint, not an oversight.
4. **Cross-midnight appointments are out of scope.** `AvailabilityWindowEngine` requires an interval's local start and end to resolve to the same calendar day; an interval spanning midnight is flagged `timezone_conflict` rather than validated against two different days' working hours. Disclosed in `types/scheduling.ts`'s own field comments and `availabilityWindowEngine.ts`.
5. **`evaluateWorkspaceSchedulingAction`'s capacity checks are a live snapshot, not a full-range analysis.** `CapacityEngine.checkCapacity` is called once per calendar/rule pair at `now`, not swept across the whole 7-day evaluation window — a capacity breach that occurs only later in the window may not surface until a subsequent evaluation. Documented in `schedulingActions.ts`'s own comments.
6. **No creation UI for Calendars/Appointments/Reservations/config rows.** The same precedent Capability Requirements and Executive Decisions established — entities are created via the module action layer, exercised directly in tests; the dashboards cover every read/evaluate surface the spec asked for.
7. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: clean (including the new `react-hooks/set-state-in-effect` rule, resolved by matching `CapabilityDashboardView.tsx`'s exact inline-effect pattern rather than extracting a shared `loadAll` helper)
- `vitest run`: **6491/6491 tests passing** across 697 files (260 new tests across 27 new files for this platform alone: 16 core engine test files, 8 mock store test files, the `schedulingActions.ts` integration suite, and 2 dashboard component test files)
- `next build`: succeeds, including the two new `/calendar` and `/calendar/[id]` routes

## Success criteria, answered

- **When can work happen?** `AvailabilityWindowEngine.resolveAvailabilityForInterval` — the single authoritative yes/no, reasoned through holidays, blackout windows, explicit overrides, and working hours in that order.
- **What time windows are available?** `CalendarWindow`s of type `"available"`, plus every `WorkingHoursRule`'s resolved hours per day.
- **Which reservations already exist?** `Reservation[]`, with `ReservationEngine`'s computed-not-stored expiry state always overlaid on top.
- **Where are the scheduling conflicts?** `ConflictEngine`'s 10 named types, each with a severity, a named blocking rule, and the affected appointment/reservation ids.
- **Which buffers are required?** `Appointment.preparation_minutes`/`cleanup_minutes`, enforced by `BufferEngine` as a real, checked constraint.
- **What capacity remains?** `CapacityEngine.checkCapacity` — current usage vs. `max_concurrent`, per worker/team/resource/workspace, per day or time window.
- **How healthy is the schedule?** `SchedulingScores.calendarHealthScore` — six disclosed, deterministic component scores, visible per-calendar on the Detail View and averaged workspace-wide on the Dashboard.
- **Can a future Dispatch Platform consume these schedules without reimplementing scheduling logic?** Yes — `evaluateWorkspaceSchedulingAction`, `getCalendarViewAction`, and every CRUD action return complete, typed results (`CalendarView`, `SchedulingScores`, `SchedulingFinding[]`, `SchedulingConflict[]`) a dispatcher can read directly, and `Appointment.worker_id` is already the exact slot a future Dispatch checkpoint fills in.

Stop condition honored throughout: no worker selection, no worker assignment, no dispatch, no route optimization, no travel-time estimation, no live GPS, no field execution, no AI, no duplicated Capability/Workforce/Executive/Operational Intelligence/Knowledge Graph logic.
