import type { PresenceStatus } from "@/types/communication";

/**
 * v2.0 Checkpoint 24, Step 11 — Presence System. Pure derivation only; the
 * module layer's `presenceActions.ts` owns the actual read/write against
 * `presenceStore.ts`. There is no realtime transport anywhere in BloomOS
 * (Client Portal Messages' own Checkpoint 14 doc comment calls this out as
 * a deliberate non-goal) — presence here means "was this member's client
 * recently heartbeating," not a live socket push, and every UI surface
 * showing a presence dot should re-fetch periodically rather than assume
 * push updates.
 */

const AWAY_AFTER_MS = 5 * 60_000;
const OFFLINE_AFTER_MS = 15 * 60_000;

/**
 * `manualStatus` (`"busy"`/`"dnd"`) always wins — a member who set
 * themselves Do Not Disturb stays Do Not Disturb regardless of how
 * recently they last heartbeated, until they clear it. Absent a manual
 * override, status is purely a function of recency: online, then away,
 * then offline.
 */
export function deriveStatus(lastActiveAt: string, manualStatus: "busy" | "dnd" | null, now: Date): PresenceStatus {
  if (manualStatus) return manualStatus;
  const elapsedMs = now.getTime() - new Date(lastActiveAt).getTime();
  if (elapsedMs < AWAY_AFTER_MS) return "online";
  if (elapsedMs < OFFLINE_AFTER_MS) return "away";
  return "offline";
}
