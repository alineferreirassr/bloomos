import { describe, expect, it } from "vitest";
import { isReservationExpired, resolveEffectiveReservationStatus, isReservationActive, findConflictingReservations, checkCanConfirmReservation } from "@/core/scheduling/reservationEngine";
import type { Reservation } from "@/types/scheduling";

const NOW = "2026-08-03T12:00:00.000Z";

function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: "reservation_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    resource_type: "worker",
    resource_id: "worker_1",
    starts_at: "2026-08-03T13:00:00.000Z",
    ends_at: "2026-08-03T14:00:00.000Z",
    status: "held",
    source: "manual",
    priority: "medium",
    hold_expires_at: "2026-08-03T12:30:00.000Z",
    appointment_id: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isReservationExpired", () => {
  it("is false for a held reservation whose hold has not yet lapsed", () => {
    expect(isReservationExpired(makeReservation({ hold_expires_at: "2026-08-03T13:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is true for a held reservation past its hold_expires_at", () => {
    expect(isReservationExpired(makeReservation({ hold_expires_at: "2026-08-03T11:00:00.000Z" }), NOW)).toBe(true);
  });

  it("is false for a held reservation with no hold_expires_at", () => {
    expect(isReservationExpired(makeReservation({ hold_expires_at: null }), NOW)).toBe(false);
  });

  it("is false for a confirmed reservation regardless of hold_expires_at", () => {
    expect(isReservationExpired(makeReservation({ status: "confirmed", hold_expires_at: "2026-08-03T11:00:00.000Z" }), NOW)).toBe(false);
  });
});

describe("resolveEffectiveReservationStatus", () => {
  it("overlays expired on a lapsed held reservation without mutating the stored status", () => {
    const reservation = makeReservation({ hold_expires_at: "2026-08-03T11:00:00.000Z" });
    expect(resolveEffectiveReservationStatus(reservation, NOW)).toBe("expired");
    expect(reservation.status).toBe("held");
  });

  it("passes through the stored status when not expired", () => {
    expect(resolveEffectiveReservationStatus(makeReservation({ status: "confirmed", hold_expires_at: null }), NOW)).toBe("confirmed");
  });
});

describe("isReservationActive", () => {
  it("is true for a still-valid held reservation", () => {
    expect(isReservationActive(makeReservation(), NOW)).toBe(true);
  });

  it("is true for a confirmed reservation", () => {
    expect(isReservationActive(makeReservation({ status: "confirmed", hold_expires_at: null }), NOW)).toBe(true);
  });

  it("is false for an expired hold", () => {
    expect(isReservationActive(makeReservation({ hold_expires_at: "2026-08-03T11:00:00.000Z" }), NOW)).toBe(false);
  });

  it("is false for a cancelled reservation", () => {
    expect(isReservationActive(makeReservation({ status: "cancelled", hold_expires_at: null }), NOW)).toBe(false);
  });
});

describe("findConflictingReservations", () => {
  it("finds an overlapping active reservation for the same resource", () => {
    const candidate = { id: "new", resource_type: "worker" as const, resource_id: "worker_1", starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z" };
    const existing = [makeReservation()];
    expect(findConflictingReservations(candidate, existing, NOW)).toHaveLength(1);
  });

  it("ignores a non-overlapping reservation for the same resource", () => {
    const candidate = { id: "new", resource_type: "worker" as const, resource_id: "worker_1", starts_at: "2026-08-03T14:00:00.000Z", ends_at: "2026-08-03T15:00:00.000Z" };
    const existing = [makeReservation()];
    expect(findConflictingReservations(candidate, existing, NOW)).toHaveLength(0);
  });

  it("ignores a reservation for a different resource_id", () => {
    const candidate = { id: "new", resource_type: "worker" as const, resource_id: "worker_2", starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z" };
    const existing = [makeReservation()];
    expect(findConflictingReservations(candidate, existing, NOW)).toHaveLength(0);
  });

  it("ignores an expired hold", () => {
    const candidate = { id: "new", resource_type: "worker" as const, resource_id: "worker_1", starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z" };
    const existing = [makeReservation({ hold_expires_at: "2026-08-03T11:00:00.000Z" })];
    expect(findConflictingReservations(candidate, existing, NOW)).toHaveLength(0);
  });

  it("excludes the candidate's own id from the comparison set", () => {
    const candidate = { id: "reservation_1", resource_type: "worker" as const, resource_id: "worker_1", starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z" };
    const existing = [makeReservation({ id: "reservation_1" })];
    expect(findConflictingReservations(candidate, existing, NOW)).toHaveLength(0);
  });
});

describe("checkCanConfirmReservation", () => {
  it("allows confirming a still-valid held reservation", () => {
    expect(checkCanConfirmReservation(makeReservation(), NOW)).toEqual({ canConfirm: true, reason: null });
  });

  it("blocks confirming an already-cancelled reservation", () => {
    const result = checkCanConfirmReservation(makeReservation({ status: "cancelled" }), NOW);
    expect(result.canConfirm).toBe(false);
  });

  it("blocks confirming an already-confirmed reservation", () => {
    const result = checkCanConfirmReservation(makeReservation({ status: "confirmed" }), NOW);
    expect(result.canConfirm).toBe(false);
  });

  it("blocks confirming an expired hold", () => {
    const result = checkCanConfirmReservation(makeReservation({ hold_expires_at: "2026-08-03T11:00:00.000Z" }), NOW);
    expect(result.canConfirm).toBe(false);
    expect(result.reason).toBe("This hold has expired.");
  });
});
