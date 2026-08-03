# Location Foundation

v2.0 Checkpoint 26, Step 9. Infrastructure only, per the stop condition's explicit "Do NOT implement route optimization. Do NOT implement maps. Do NOT implement GPS history." This checkpoint stores exactly one thing per worker: their single latest known location.

## LocationSnapshot

```ts
interface LocationSnapshot {
  worker_id: string;
  workspace_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  recorded_at: string;
  source: "mobile_app" | "manual";
}
```

## No history, by design

`lib/data/mock/locationStore.ts` keeps a `Map<worker_id, LocationSnapshot>` — every `recordSnapshot()` call *overwrites* the previous entry for that worker rather than appending to a list. This is the opposite of `availabilityStore.ts`'s window-log approach (see [`availability.md`](availability.md)), and that's intentional: a GPS trail is exactly what "no GPS history" rules out. If a future checkpoint needs a real location history for route reconstruction, it will need its own explicitly-scoped store — this one cannot be quietly repurposed into one.

## The only real logic: staleness

`core/workforce/locationEngine.ts` has two functions:

- `isSnapshotStale(snapshot, now, staleAfterMinutes = 30)` — is this the worker's real current position, or old enough that the UI should say "last seen a while ago" instead of implying live tracking?
- `minutesSinceRecorded(snapshot, now)` — the raw age, for display.

No distance math, no geofencing, no proximity alerts, no map rendering — all deliberately absent this checkpoint.

## Recording a snapshot

`recordLocationSnapshotAction` (`modules/workforce/workforceActions.ts`) is the only write path — it takes `latitude`/`longitude`/`accuracy_meters`/`source` and overwrites the worker's stored snapshot. There is no automatic polling; every snapshot is the result of an explicit call (from the future mobile app, or a manual entry).
