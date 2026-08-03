import type { Reservation, ReservationStatus } from "@/types/scheduling";

/**
 * v2.0 Checkpoint 27, Step 6 — Reservation Engine. Same "definition vs.
 * computed" discipline established for `Worker`/mobile-session status
 * elsewhere in this codebase: `Reservation.status` is the last WRITTEN
 * state, but "is this hold actually still good right now" is always a
 * pure function of `hold_expires_at` and a caller-supplied `now` —
 * never a stored timer.
 */

/** `true` only for a `"held"` reservation whose hold has actually lapsed — a `"held"` reservation with `hold_expires_at: null` never auto-expires. */
export function isReservationExpired(reservation: Pick<Reservation, "status" | "hold_expires_at">, now: string): boolean {
  return reservation.status === "held" && reservation.hold_expires_at !== null && reservation.hold_expires_at <= now;
}

/** Overlays the computed `"expired"` state on top of the stored status — the stored value itself is only corrected once a caller calls `setReservationStatus`. */
export function resolveEffectiveReservationStatus(reservation: Pick<Reservation, "status" | "hold_expires_at">, now: string): ReservationStatus {
  if (isReservationExpired(reservation, now)) return "expired";
  return reservation.status;
}

/** A reservation counts toward resource conflicts only while it's genuinely active — `held` (not yet expired) or `confirmed`. `cancelled`/`expired` reservations never block anything. */
export function isReservationActive(reservation: Pick<Reservation, "status" | "hold_expires_at">, now: string): boolean {
  const effective = resolveEffectiveReservationStatus(reservation, now);
  return effective === "held" || effective === "confirmed";
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Finds every other active reservation for the same `resource_type`/`resource_id` whose interval overlaps the proposed one — the raw material `ConflictEngine`'s `resource_overlap` conflict type is built from. */
export function findConflictingReservations(candidate: Pick<Reservation, "id" | "resource_type" | "resource_id" | "starts_at" | "ends_at">, existingReservations: Reservation[], now: string): Reservation[] {
  return existingReservations.filter((r) => {
    if (r.id === candidate.id) return false;
    if (r.resource_type !== candidate.resource_type || r.resource_id !== candidate.resource_id) return false;
    if (!isReservationActive(r, now)) return false;
    return overlaps(candidate.starts_at, candidate.ends_at, r.starts_at, r.ends_at);
  });
}

export interface ReservationConfirmationCheck {
  canConfirm: boolean;
  reason: string | null;
}

export function checkCanConfirmReservation(reservation: Pick<Reservation, "status" | "hold_expires_at">, now: string): ReservationConfirmationCheck {
  if (reservation.status === "cancelled") return { canConfirm: false, reason: "This reservation was already cancelled." };
  if (reservation.status === "confirmed") return { canConfirm: false, reason: "This reservation is already confirmed." };
  if (isReservationExpired(reservation, now)) return { canConfirm: false, reason: "This hold has expired." };
  return { canConfirm: true, reason: null };
}
