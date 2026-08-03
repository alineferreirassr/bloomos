import type { Appointment } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 8 — Buffer Engine. `preparation_minutes` and
 * `cleanup_minutes` (Checkpoint 27's `Appointment` fields) extend an
 * appointment's real, blocked interval on either side. `starts_at`/
 * `ends_at` are true UTC instants (never local wall-clock, unlike
 * `WorkingHoursRule`'s `HH:mm` fields), so plain `Date` arithmetic is
 * correct here — no timezone resolution needed.
 */

export interface EffectiveInterval {
  effectiveStart: string;
  effectiveEnd: string;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function computeEffectiveInterval(appointment: Pick<Appointment, "starts_at" | "ends_at" | "preparation_minutes" | "cleanup_minutes">): EffectiveInterval {
  return {
    effectiveStart: addMinutes(appointment.starts_at, -appointment.preparation_minutes),
    effectiveEnd: addMinutes(appointment.ends_at, appointment.cleanup_minutes),
  };
}

/** Minutes the two appointments' buffered intervals overlap by — `0` when they don't overlap at all. */
export function computeBufferOverlapMinutes(a: Pick<Appointment, "starts_at" | "ends_at" | "preparation_minutes" | "cleanup_minutes">, b: Pick<Appointment, "starts_at" | "ends_at" | "preparation_minutes" | "cleanup_minutes">): number {
  const intervalA = computeEffectiveInterval(a);
  const intervalB = computeEffectiveInterval(b);
  const overlapStart = Math.max(new Date(intervalA.effectiveStart).getTime(), new Date(intervalB.effectiveStart).getTime());
  const overlapEnd = Math.min(new Date(intervalA.effectiveEnd).getTime(), new Date(intervalB.effectiveEnd).getTime());
  return Math.max(0, Math.round((overlapEnd - overlapStart) / 60_000));
}

/** `true` when the two appointments' buffered intervals overlap — the core/off-hours times themselves might not overlap, but prep/cleanup still collides. */
export function hasBufferConflict(a: Pick<Appointment, "starts_at" | "ends_at" | "preparation_minutes" | "cleanup_minutes">, b: Pick<Appointment, "starts_at" | "ends_at" | "preparation_minutes" | "cleanup_minutes">): boolean {
  return computeBufferOverlapMinutes(a, b) > 0;
}
