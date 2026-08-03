# Presence System (v2 Checkpoint 24, Step 11)

Genuinely greenfield — an exhaustive grep across the entire codebase (`last_active`, `online`, `presence`, `last_seen`) before this checkpoint began confirmed zero prior concept of member presence, in mock or Supabase mode.

## Design

`core/communication/presenceEngine.ts`'s `deriveStatus(lastActiveAt, manualStatus, now)` is pure:

```
manualStatus set ("busy" | "dnd")  → that status, always wins
elapsed < 5 minutes                → "online"
elapsed < 15 minutes                → "away"
elapsed >= 15 minutes                → "offline"
```

A manual override (Busy / Do Not Disturb) always wins over recency — a member who deliberately set themselves Do Not Disturb stays Do Not Disturb regardless of how recently their client last heartbeated, until they explicitly clear it.

`lib/data/core/communication/presenceStore.ts` holds one row per member (current state, not an append-only log, the same shape `notificationPreferencesStore.ts` uses) — `heartbeat()` upserts `last_active_at` to now; `setManualStatus()` sets/clears the override.

## No realtime — this is a polled read, not a push

There is no websocket or SSE transport anywhere in BloomOS (Client Portal Messages' own Checkpoint 14 doc comment already establishes "no realtime" as a deliberate, workspace-wide precedent, not something specific to messaging). Presence here means "was this member's client recently heartbeating," derived by a client periodically calling `heartbeatAction()` (e.g., on an interval, or on visibility change) and any other surface reading `getWorkspacePresenceAction()` on its own normal data-fetch cadence. A presence dot is only ever as fresh as the last time the viewing surface itself re-fetched — there is no live push the moment someone's status changes.

## Known limitation: no UI surface mounts a live presence indicator yet

`presenceActions.ts` (`heartbeatAction`, `setManualPresenceStatusAction`, `getWorkspacePresenceAction`) is complete, real, and ready to call — but this checkpoint does not wire a heartbeat interval into any mounted client component, nor render a presence dot on a Team Member avatar anywhere in the app. This is an honestly-scoped gap: the engine and the store are real and tested (`presenceEngine.test.ts`), but "Online/Offline/Away/Busy/Do Not Disturb, Last Seen" as a *visible* feature on a real screen is not yet mounted anywhere.
