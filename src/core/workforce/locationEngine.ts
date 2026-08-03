import type { LocationSnapshot } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 9 — Location Foundation's only real logic. No
 * routing, no maps, no distance/geofencing math, no GPS history — this
 * engine answers exactly one question honestly: "is the one snapshot we
 * have for this worker still fresh, or should the UI say 'last seen a
 * while ago' instead of implying we know where they are right now?"
 */
export const DEFAULT_STALE_AFTER_MINUTES = 30;

export function isSnapshotStale(snapshot: Pick<LocationSnapshot, "recorded_at">, now: string, staleAfterMinutes = DEFAULT_STALE_AFTER_MINUTES): boolean {
  const ageMs = new Date(now).getTime() - new Date(snapshot.recorded_at).getTime();
  return ageMs > staleAfterMinutes * 60 * 1000;
}

export function minutesSinceRecorded(snapshot: Pick<LocationSnapshot, "recorded_at">, now: string): number {
  return Math.floor((new Date(now).getTime() - new Date(snapshot.recorded_at).getTime()) / (60 * 1000));
}
