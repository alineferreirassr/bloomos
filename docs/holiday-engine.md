# Holiday Engine

`src/core/scheduling/holidayEngine.ts` — v2.0 Checkpoint 27, Step 11.

## What it answers

Is a given local date a holiday for this workspace — and if so, is it a routine holiday or an emergency closure that overrides everything else?

## Model

`Holiday` has `scope` (`workspace`/`regional`/`custom` — categorization only, every holiday still belongs to one workspace via `workspace_id`), a `date`, `recurring: boolean`, and `emergency: boolean`.

- A **recurring** holiday matches on month/day only (`date.slice(5)`) — the stored year is irrelevant; "New Year's Day" saved once in 2026 matches every year after.
- A **non-recurring** holiday matches its exact date only (e.g. an emergency weather closure that never repeats).

```ts
findHolidayForDate(holidays, workspaceId, localDate): Holiday | null
isHoliday(holidays, workspaceId, localDate): boolean
isEmergencyClosure(holidays, workspaceId, localDate): boolean
listHolidaysInRange(holidays, workspaceId, rangeStart, rangeEnd): HolidayOccurrence[]
```

## `listHolidaysInRange` expands occurrences, not raw rows

A recurring holiday stored once must appear once per year a queried range spans, dated to the *matched* year — not the year it happened to be created in. `listHolidaysInRange` returns `HolidayOccurrence[]` (`{ holiday, date }`), where `date` is the real occurrence date for that range, distinct from `holiday.date`'s original stored year. This exact gap was caught by this file's own test suite on the first run: an earlier version returned the stored `Holiday` object unchanged, so a Calendar Dashboard querying 2028 would have shown "2026-01-01" instead of "2028-01-01."

## Priority: emergency beats everything

`isEmergencyClosure` is checked *before* any `CalendarWindow` override in `availabilityWindowEngine.resolveAvailabilityForInterval` — an emergency closure (severe weather, workspace-wide shutdown) can never be worked around by an explicit `"available"` window, unlike a routine holiday.

## Consumers

- `availabilityWindowEngine.ts` / `conflictEngine.ts` (`holiday_conflict`) — blocks scheduling on holidays.
- `schedulingRiskEngine.ts` — the `holiday_conflict` finding, `"high"` severity for emergencies, `"medium"` otherwise.
- Calendar Dashboard's Holiday Calendar section.
