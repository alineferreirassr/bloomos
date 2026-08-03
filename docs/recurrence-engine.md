# Recurrence Engine

`src/core/scheduling/recurrenceEngine.ts` — v2.0 Checkpoint 27, Step 9.

## What it answers

Given a `RecurrenceRule` and a seed date (an appointment's first occurrence), which calendar dates does it produce within a query range?

## Model

`RecurrenceRule.frequency` is `daily`/`weekly`/`monthly`/`yearly`, with `interval` (every N units), an optional `end_date`, an optional `occurrence_count`, and `exception_dates` (explicitly excluded dates). `weekly` additionally takes `days_of_week`; `monthly` takes either a fixed `day_of_month` or an `nth_weekday` (`{ week: 1-4 | -1, weekday: 0-6 }` — "2nd Tuesday" or "last Friday"), mutually exclusive.

```ts
generateOccurrenceDates(rule, seedDate, rangeStart, rangeEnd): string[]
isOccurrenceDate(rule, seedDate, candidateDate): boolean
```

Pure calendar-date arithmetic via `Date.UTC` used only as a date calculator — never a real instant, never timezone-aware, since a recurrence rule's dates are inherently local to whichever calendar owns the appointment.

## `occurrence_count` counts from the seed, not from the query range

A rule capped at 5 occurrences is capped at 5 total, even when `rangeStart` is later than the seed — occurrence numbering always starts at the seed date and walks forward, so querying "week 3 onward" of a 5-occurrence rule correctly returns fewer results, never the same 5 shifted forward.

## Safety cap

`MAX_OCCURRENCES_SAFETY_CAP = 2000` (~5.5 years of daily occurrences) bounds every call — an unbounded rule (no `end_date`, no `occurrence_count`) queried over a huge range can't spin the engine forever.

## What this engine does not do

It only produces **dates**. Turning a date into a real `Appointment` occurrence — applying the seed's time-of-day and duration, running conflict/capacity checks — is the caller's job. `calendarEngine.buildCalendarView()` is that caller: the stored `Appointment` itself is the seed occurrence (never virtual); every other generated date becomes a synthesized, non-persisted entry (`isRecurringInstance: true`) built by shifting the seed's time-of-day onto the new date, never a second database row.

## Consumers

- `calendarEngine.ts` — expands recurring appointments for calendar rendering.
- `schedulingRiskEngine.ts` — walks a 90-day lookahead per recurring appointment to detect `recurring_conflict`.
