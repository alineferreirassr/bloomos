# Offline Foundation

v2.0 Checkpoint 26, Step 8. Infrastructure only — this checkpoint records that a mobile client queued a change while offline. It does not implement sync, conflict resolution, retry, or a background processor. Per the stop condition ("Build only the reusable operational foundation that future checkpoints will extend"), that's deliberately left for later work.

## OfflineQueueEntry

```ts
interface OfflineQueueEntry {
  id: string;
  workspace_id: string;
  worker_id: string;
  mobile_session_id: string;
  entity_type: string;
  entity_id: string | null;
  payload_summary: string;
  status: OfflineQueueEntryStatus; // pending | synced | failed
  queued_at: string;
  synced_at: string | null;
}
```

## What actually happens today

`queueOfflineEntryAction` (`modules/workforce/workforceActions.ts`) writes exactly one thing: a new `OfflineQueueEntry` with `status: "pending"` and `synced_at: null`. Nothing in this checkpoint ever transitions an entry to `"synced"` or `"failed"` — those two statuses exist in the type and the store's `OFFLINE_QUEUE_ENTRY_STATUSES` list purely so a future checkpoint's real sync engine has real states to write into, rather than that checkpoint needing to invent a new type from scratch.

## `summarizeOfflineQueue`

`core/workforce/offlineEngine.ts`'s only function — a pure count of pending/synced/failed entries plus the oldest still-pending entry's `queued_at`, used by the Workforce Dashboard's "Mobile & Offline Foundation" card. This is the entirety of this checkpoint's "offline" logic: a count, honestly labeled as infrastructure, not a working sync pipeline.

## Why this shape

`entity_type`/`entity_id`/`payload_summary` are deliberately generic strings rather than a typed union of every entity this checkpoint could eventually queue changes for — inventing that taxonomy now, before any real offline mutation flow exists to populate it, would be speculative. A future checkpoint building the actual offline mutation queue for (say) Checklist completions or Timeline notes can extend this shape once it knows what it actually needs to carry.
