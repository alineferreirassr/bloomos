# Buffer Engine

`src/core/scheduling/bufferEngine.ts` — v2.0 Checkpoint 27, Step 8.

## What it answers

Given an appointment's own `preparation_minutes`/`cleanup_minutes`, what's its real blocked interval — and do two appointments' buffered intervals collide even when their core times don't?

## Model

`Appointment.starts_at`/`ends_at` are true UTC instants (unlike `WorkingHoursRule`'s local `HH:mm`), so this engine does plain `Date` arithmetic — no timezone resolution needed.

```ts
computeEffectiveInterval(appointment): { effectiveStart: string; effectiveEnd: string }
computeBufferOverlapMinutes(a, b): number
hasBufferConflict(a, b): boolean
```

`effectiveStart` = `starts_at` minus `preparation_minutes`; `effectiveEnd` = `ends_at` plus `cleanup_minutes`. Two appointments whose buffered intervals merely touch (one's cleanup ends exactly when the next's setup begins) are **not** a conflict — only a genuine overlap counts.

## Never double-reports as `time_overlap`

`conflictEngine.detectAppointmentConflicts` checks a pair's *core* times first; only when the core times don't overlap does it check `hasBufferConflict` for that same pair. A pair whose core times genuinely overlap is reported once, as `time_overlap` — never as both `time_overlap` and `buffer_conflict` for the same collision.

## Consumers

- `conflictEngine.ts` — the `buffer_conflict` conflict type.
- `schedulingScoreEngine.ts` — `bufferQualityScore` (share of appointments free of a buffer conflict).
