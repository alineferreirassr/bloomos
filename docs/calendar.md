# Calendar Engine & Availability Windows

`src/core/scheduling/calendarEngine.ts` (Step 2) and `src/core/scheduling/availabilityWindowEngine.ts` (Step 4) — v2.0 Checkpoint 27.

## Naming note

`Calendar`/`Appointment` (this checkpoint) are a completely different concept from `EventScheduleItem` (`types/eventScheduleItem.ts`, pre-existing) — a per-Event day-of itinerary entry. A `Calendar` is workspace-wide, cross-worker/resource scheduling infrastructure with recurrence, capacity, and conflict detection; an `EventScheduleItem` is a single Event's own run-of-show. Neither duplicates the other, and their Timeline event names never collide (`schedule_item_*` vs. `appointment_*`/`calendar_*`).

## Calendar

A `Calendar` belongs to a `context_type` (`worker`/`team`/`equipment`/`vehicle`/`workspace`/`custom`) and optionally a real Knowledge Graph `context` node (`null` for `custom`, since there's no real node type to point at). It carries its own `time_zone` — every `WorkingHoursRule` on it is interpreted in that zone.

## Calendar Engine — assembling a view for rendering

```ts
buildCalendarView(calendarId, granularity, rangeStart, rangeEnd, appointments, recurrenceRules): CalendarView
```

For each non-cancelled appointment on the calendar:
- **No recurrence** — included once if it overlaps the queried range.
- **Recurring** (`recurrence_rule_id` set) — the stored `Appointment` row *is* the seed occurrence; `RecurrenceEngine.generateOccurrenceDates()` expands every other occurrence date within range into a synthesized `CalendarViewEntry` (`isRecurringInstance: true`), built by shifting the seed's own time-of-day onto the new date via `shiftAppointmentToDate()`. Never a second persisted `Appointment` row.

## Availability Window Engine — is a proposed interval actually open?

```ts
resolveAvailabilityForInterval(input: AvailabilityWindowInput): { available: boolean; reason: string | null }
```

Resolution order, most authoritative first:
1. An **emergency holiday** always wins (`HolidayEngine.isEmergencyClosure`).
2. Any overlapping **blocking `CalendarWindow`** (`type !== "available"`) — covers both "Availability Windows" and "Blackout Periods" from the spec, since a blackout is simply a `"blocked"`-type window, optionally scoped workspace-wide via `calendar_id: null`.
3. A routine (non-emergency) **holiday**.
4. An explicit **`"available"`-type `CalendarWindow`** that fully covers the interval — an override that can open a calendar even outside its own working hours (e.g. a one-off Saturday appointment).
5. Otherwise, fall back to **`WorkingHoursEngine`** — the interval's local start/end must fall within the applicable rule's hours, and both ends must resolve to the same local calendar day (this platform's disclosed cross-midnight limitation).

## Consumers

- `schedulingActions.getCalendarViewAction()` — the Calendar Detail View's data source.
- `schedulingRiskEngine.ts` — `unavailable_time_window` re-runs `resolveAvailabilityForInterval` against every live appointment.
