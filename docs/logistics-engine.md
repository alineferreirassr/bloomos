# Logistics Engine (v2 Checkpoint 21, Step 5)

## The Logistics Center was "nearly free"

The spec asks for Arrival, Setup, Ceremony, Photography, Cleanup, Departure, Travel Buffer, Loading, and Unloading. Research into the existing codebase found that `EventScheduleItem.category` (`ScheduleCategory`, `core/enums/scheduleCategory.ts`) already covers `arrival, delivery, setup, vendor, client, surprise, ceremony, photography, video, food_beverage, cleanup, departure, other` — six of the spec's exact named phases already exist as real, filterable schedule-item categories. `core/operations/logisticsEngine.ts`'s `buildLogisticsPlan()` is a grouped, time-ordered *view* over an Event's own real `getScheduleByEventId()` data — never a new schedule model, never a new form, never a new data table.

## What's computed vs. what's real

| Field | Source |
|---|---|
| Phase entries (Arrival/Setup/Ceremony/Photography/Cleanup/Departure) | Real `EventScheduleItem` rows, filtered to the 6 mapped categories, sorted by `start_time` |
| Travel Buffer | **Computed** — the real time gap, in minutes, between one schedule item's `end_time` (or `start_time` if no end time) and the next item's `start_time` |
| Loading | **Derived note** — built from the real Arrival/Delivery item's own `start_time` and `title` |
| Unloading | **Derived note** — built from the real Departure item's own `start_time` and `title` |

Categories with no logistics-phase mapping (`vendor`, `client`, `surprise`, `food_beverage`, `other`) are simply omitted from the phase list — they're still visible on the Event's existing Schedule Summary card, just not part of the Logistics Center's 6-phase view, since the spec names exactly 6 phases.

## Why Loading/Unloading are notes, not new fields

No dedicated "loading window" or "unloading window" field exists anywhere in this codebase's schedule model, and adding one would mean a schema change this checkpoint's own stop condition ("reuse the existing architecture") argues against. Instead, `buildLogisticsPlan()` honestly derives a loading note from the real Arrival/Delivery schedule item's own time, and an unloading note from the real Departure item's own time — and says so plainly ("No arrival/delivery schedule item found — add one to plan a loading window") when neither exists, rather than fabricating a time.

## Travel Buffer semantics

```ts
const currentEnd = toMinutes(current.end_time) ?? toMinutes(current.start_time);
const nextStart = toMinutes(next.start_time);
const minutes = currentEnd !== null && nextStart !== null ? Math.max(0, nextStart - currentEnd) : null;
```

A buffer is `null` (never a fabricated `0`) when either side of the gap has no time set — the UI renders `—` in that case, honestly reporting "we don't know," not "there's no gap."

## Where it's displayed

The Event Command Center's "Logistics Center" section: a list of phase entries (name + time) followed by the Loading/Unloading notes. Travel buffers themselves are computed and available on the `LogisticsPlan` type but not currently rendered as their own list item in the Command Center UI — the phase list plus the two derived notes cover the spec's own display requirement without adding a third redundant list to an already-dense card.

## Extension point

Adding a 7th named phase (e.g. a future "Breakdown" phase, distinct from `cleanup`) means adding one entry to `SCHEDULE_CATEGORY_TO_PHASE` and to the `LOGISTICS_PHASES`/`LOGISTICS_PHASE_LABELS` tuple in `core/operations/types.ts` — no change to the grouping/buffer-computation logic itself.
