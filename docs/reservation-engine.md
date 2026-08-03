# Reservation Engine

`src/core/scheduling/reservationEngine.ts` — v2.0 Checkpoint 27, Step 6.

## What it answers

Is a reservation's hold still good, can it be confirmed, and which other reservations for the same resource does it collide with?

## Model

A `Reservation` ties a `resource_type` (`worker`/`equipment`/`vehicle`/`asset`) and `resource_id` to an interval. `status` is `held`/`confirmed`/`expired`/`cancelled`. Creating one with `hold_expires_at: null` makes it `confirmed` immediately (a permanent, non-expiring reservation); a non-null `hold_expires_at` creates it `held`.

## Definition vs. computed — the same discipline as Worker/mobile-session status

`Reservation.status` is the last **written** state. Whether a hold has actually lapsed is always a pure function of `hold_expires_at` and a caller-supplied `now` — never a stored timer:

```ts
isReservationExpired(reservation, now): boolean
resolveEffectiveReservationStatus(reservation, now): ReservationStatus   // overlays "expired" without mutating the row
isReservationActive(reservation, now): boolean                          // held (not yet expired) or confirmed
findConflictingReservations(candidate, existingReservations, now): Reservation[]
checkCanConfirmReservation(reservation, now): { canConfirm, reason }
```

A `held` reservation with `hold_expires_at: null` never auto-expires. `sweepExpiredReservationsAction` (module layer) is what actually writes `status: "expired"` back to the store, recording `reservation_expired` on the Timeline — the engine itself never mutates anything.

## Consumers

- `conflictEngine.detectReservationConflicts()` — maps `resource_type` to the matching `ConflictType` (`worker_conflict`/`equipment_conflict`/`vehicle_conflict`/`resource_overlap`).
- `schedulingActions.ts` — `createReservationAction` rejects a genuinely conflicting reservation before it's ever persisted; `confirmReservationAction` calls `checkCanConfirmReservation` first.
- `schedulingRiskEngine.ts` — the `reservation_expiration` finding (both "already expired" and "expiring within the warning window").
