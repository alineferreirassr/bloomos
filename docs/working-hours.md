# Working Hours Engine

`src/core/scheduling/workingHoursEngine.ts` — v2.0 Checkpoint 27, Step 3.

## What it answers

Given a calendar and a local date/weekday, what hours is it open — and by which specific rule?

## Model

A `WorkingHoursRule` is one of six `kind`s: `regular`, `custom`, `holiday`, `weekend`, `temporary_override`, `seasonal`. Each rule is either day-of-week-based (`day_of_week: 0-6`) or date-specific (`specific_date`), never both. `is_closed: true` means "closed all day" — `starts_time`/`ends_time` are ignored.

## Resolution order — most specific wins

1. A `specific_date` match always beats a `day_of_week` match, regardless of `kind`. A one-off `temporary_override` for December 24th wins over a `regular` Tuesday rule even though `temporary_override` also happens to rank highest in the tie-break order below — the date match alone is what decides it.
2. Among rules at the same specificity (two day-of-week rules, or two date-specific rules), `kind` breaks the tie, lowest to highest: `regular` → `weekend` → `seasonal` → `custom` → `holiday` → `temporary_override`.

```ts
resolveApplicableWorkingHoursRule(rules, calendarId, localDate, dayOfWeek): WorkingHoursRule | null
isWithinWorkingHours(rules, calendarId, localDate, dayOfWeek, localTime): { isOpen: boolean; rule: WorkingHoursRule | null }
```

No matching rule at all resolves to **closed** — an unconfigured calendar never silently accepts bookings just because nothing said no.

## No timezone arithmetic inside the engine

`starts_time`/`ends_time` are `HH:mm`, explicitly "interpreted in `time_zone`" per the type's own doc comment — genuinely local wall-clock time, not a UTC instant. This engine takes an already-resolved `localDate`/`dayOfWeek`/`localTime` and only ever does string/numeric comparison. Resolving a real UTC instant (an `Appointment.starts_at`) down to those local components is `timeZoneUtils.resolveLocalDateTime()`'s job (`Intl.DateTimeFormat` — correct IANA conversion, zero dependencies, not the geocoding/travel-time work this checkpoint's stop condition excludes).

## Consumers

- `availabilityWindowEngine.ts` — the working-hours fallback when no calendar-window override applies.
- `schedulingRiskEngine.ts` — the `unavailable_time_window` finding.
- `schedulingActions.ts` — `computeAvailableMinutesForLookahead()` sums open minutes per day for `SchedulingScoreEngine`'s `scheduleDensityScore`.
