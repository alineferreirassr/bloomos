# Mobile Session Engine

v2.0 Checkpoint 26, Step 7. Session lifecycle for the (future) mobile workforce app — this checkpoint builds the session model and its TTL-based expiry logic; it does not build a mobile app, push notifications, or device management.

## MobileSession

```ts
interface MobileSession {
  id: string;
  workspace_id: string;
  worker_id: string;
  device_label: string;
  platform: "ios" | "android" | "web";
  status: MobileSessionStatus; // active | expired | revoked
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
}
```

## `status` is stored, but `"expired"` is never written by a timer

There is no background scheduler in this checkpoint — nothing periodically sweeps sessions. Instead, `core/workforce/mobileSessionEngine.ts`'s `deriveSessionStatus(session, now, ttlHours = 12)` computes `"expired"` fresh, every time it's asked, from `last_seen_at` plus a 12-hour default TTL — the same "definition vs. computed" split this checkpoint series has used everywhere else (`objectiveEngine.deriveEffectiveStatus`, `decisionEngine.deriveDecisionAgeDays`). A session's stored `status` only ever transitions via an explicit action: `startMobileSessionAction` (→ `active`), `touchMobileSessionAction` (updates `last_seen_at`, keeping it alive), or `endMobileSessionAction` (→ `revoked`).

`countActiveSessions(sessions, now, ttlHours)` — used by the Workforce Scorecard's `activeMobileSessions` figure — counts only sessions whose *derived* status is `active`, so a stale session that hasn't been touched in over 12 hours correctly stops counting even though its stored `status` field still literally says `"active"`.

## Timeline

`startMobileSessionAction`/`endMobileSessionAction` record `mobile_session_started`/`mobile_session_ended` on the worker — the same Timeline trail every other checkpoint uses, never a second audit log.

## What this is not

No push infrastructure, no offline sync (see [`offline-foundation.md`](offline-foundation.md) for that separate, narrower concern), no device fingerprinting or fraud detection, no session-hijacking defenses beyond what the existing Permissions layer already provides at the module-action boundary.
