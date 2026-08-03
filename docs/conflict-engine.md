# Conflict Engine

`src/core/scheduling/conflictEngine.ts` — v2.0 Checkpoint 27, Step 7.

## What it answers

Does a proposed (or existing) appointment or reservation collide with anything else — and specifically which of the 10 named conflict types is it?

## The 10 conflict types, and where each is actually detected

| Type | Detected by | Notes |
|---|---|---|
| `time_overlap` | `detectAppointmentConflicts` | Two appointments on the *same calendar* with overlapping core time. |
| `worker_conflict` | `detectAppointmentConflicts` (appointment `worker_id`) and `detectReservationConflicts` (reservation `resource_type: "worker"`) | Cross-calendar — a worker double-booked on two different calendars is still caught. |
| `equipment_conflict` | `detectReservationConflicts` | `resource_type: "equipment"`. |
| `vehicle_conflict` | `detectReservationConflicts` | `resource_type: "vehicle"`. |
| `resource_overlap` | `detectReservationConflicts` | `resource_type: "asset"` — the generic fallback resource type. |
| `capacity_conflict` | `buildCapacityConflict` (adapter over `CapacityEngine.checkCapacity`) | Not detected here directly; this file only builds the `SchedulingConflict` shape from a breach `CapacityEngine` already found. |
| `holiday_conflict` | `detectAppointmentConflicts` | Via `HolidayEngine.findHolidayForDate`. |
| `blackout_conflict` | `detectAppointmentConflicts` | A `CalendarWindow` whose `type !== "available"` overlapping the interval. |
| `buffer_conflict` | `detectAppointmentConflicts` | Via `BufferEngine.hasBufferConflict` — only checked when core times *don't* already overlap (see `buffer-engine.md`). |
| `timezone_conflict` | `detectAppointmentConflicts` | An interval whose local start/end (resolved via the calendar's `time_zone`) fall on different calendar days — this platform's disclosed cross-midnight limitation, not a real cross-timezone booking conflict. |

## Two entry points, matching the real data model

`Appointment` carries no `equipment_id`/`vehicle_id` of its own — only an optional `worker_id`. Resource-specific conflicts can only be detected against `Reservation`, which does carry `resource_type`/`resource_id`. So:

```ts
detectAppointmentConflicts(input: AppointmentConflictInput): SchedulingConflict[]   // time_overlap, worker_conflict, buffer_conflict, holiday_conflict, blackout_conflict, timezone_conflict
detectReservationConflicts(candidate, existingReservations, now): SchedulingConflict[]  // resource_overlap, worker_conflict, equipment_conflict, vehicle_conflict
buildCapacityConflict(input): SchedulingConflict   // capacity_conflict
```

Never re-implements `assignmentConflictEngine.ts` (Checkpoint 26.1) — that engine answers "can this worker be assigned," a WHO question; this file only ever asks "does this TIME collide with another."

## Severity

`CONFLICT_SEVERITY` maps every type to `"high"` except `buffer_conflict` and `timezone_conflict`, which are `"medium"` — soft, advisory collisions rather than hard double-bookings. `ScheduleValidationEngine` uses this split directly: `"high"` blocks a save, `"medium"` only warns.

## Consumers

- `scheduleValidationEngine.ts` — turns conflicts into blocking errors vs. non-blocking warnings.
- `schedulingActions.ts` — every create/update path runs conflicts before persisting, and syncs a `conflicts_with` Knowledge Graph edge for each real `time_overlap` found.
- `schedulingRiskEngine.ts` — the `recurring_conflict` detector re-runs `detectAppointmentConflicts` against each generated future occurrence.
