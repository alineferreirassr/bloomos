# Availability Engine

v2.0 Checkpoint 26, Step 4. `core/workforce/availabilityEngine.ts` answers "what is this worker doing right now, availability-wise" as a pure function over already-fetched data — never a scheduler, never a calendar.

## Nine named statuses

```ts
const AVAILABILITY_STATUSES = ["available", "on_assignment", "busy", "on_break", "off_duty", "vacation", "sick_leave", "training", "unavailable"] as const;
```

`on_assignment` is not a status a caller ever writes directly — see below.

## Windows, not a single field

A worker's availability is a log of `AvailabilityWindow` rows (`lib/data/mock/availabilityStore.ts`), each with a `starts_at`/`ends_at`. Recording a new window automatically closes the worker's prior open window (`ends_at: null`) at the new window's `starts_at` — a worker always has at most one open window. This preserves history rather than overwriting a single "current status" field, so a future checkpoint building a real schedule view has real data to read.

## Resolution order — `resolveCurrentAvailability`

```ts
function resolveCurrentAvailability(worker, windows, activeAssignments, now): AvailabilityStatus
```

1. **An active Assignment always wins.** If the worker has an `Assignment` with `status: "active"` right now, the resolved status is `"on_assignment"` — regardless of what their last-recorded window says. This prevents a worker who forgot to log off a manual "available" window from reading as simultaneously available and dispatched; the Assignment Engine's own state is the more authoritative signal once dispatch has actually happened.
2. **Otherwise, the window covering `now`** (`starts_at <= now && (ends_at === null || ends_at > now)`).
3. **Otherwise, the most recent past window** — a worker doesn't reset to "unavailable" the instant a window's `ends_at` passes if nothing new was recorded; their last known status is still the best available signal.
4. **Otherwise, `"unavailable"`** — a worker with no windows and no assignment has given no signal at all, and `"unavailable"` (not a silent `"available"`) is the honest default.

## Timezone-awareness

Every timestamp in this codebase is stored as UTC ISO (`nowIso()`); this engine does no timezone arithmetic. `AvailabilityWindow.time_zone` records the worker's own zone *at the time the window was recorded*, purely as display metadata — a caller renders "9am Pacific" instead of a raw UTC offset, but "is this window open right now" is decided by plain ISO string comparison against the caller-supplied `now`. No hidden `Date.now()` calls exist anywhere in this engine.

## Aggregation

`computeAvailabilitySummary(workers, windows, activeAssignments, now)` tallies every worker into exactly one of the nine buckets — the `AvailabilitySummary` the Workforce Scorecard (`workforceScorecardEngine.ts`) and dashboard both read directly.
