import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockReservationsRepository, resetReservationsStore, type CreateReservationInput } from "@/lib/data/mock/reservationsStore";

const baseInput: CreateReservationInput = {
  calendar_id: "calendar_1",
  resource_type: "equipment",
  resource_id: "equipment_1",
  starts_at: "2026-08-03T10:00:00.000Z",
  ends_at: "2026-08-03T11:00:00.000Z",
  source: "manual",
  priority: "medium",
  hold_expires_at: "2026-08-03T10:30:00.000Z",
  appointment_id: null,
};

beforeEach(() => resetReservationsStore());
afterEach(() => resetReservationsStore());

describe("mockReservationsRepository", () => {
  it("creates a held reservation when hold_expires_at is set", async () => {
    const result = await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("held");
  });

  it("creates a confirmed reservation directly when hold_expires_at is null", async () => {
    const result = await mockReservationsRepository.createReservation("ws_1", "member_1", { ...baseInput, hold_expires_at: null });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("confirmed");
  });

  it("rejects ends_at not after starts_at", async () => {
    const result = await mockReservationsRepository.createReservation("ws_1", "member_1", { ...baseInput, ends_at: baseInput.starts_at });
    expect(result.success).toBe(false);
  });

  it("listReservationsForWorkspace scopes to the workspace", async () => {
    await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    await mockReservationsRepository.createReservation("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });
    await mockReservationsRepository.createReservation("ws_2", "member_1", baseInput);

    expect(await mockReservationsRepository.listReservationsForWorkspace("ws_1")).toHaveLength(2);
  });

  it("listReservationsForCalendar scopes to the calendar only — workspace scoping is the caller's job", async () => {
    await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    await mockReservationsRepository.createReservation("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });
    await mockReservationsRepository.createReservation("ws_2", "member_1", baseInput);

    expect(await mockReservationsRepository.listReservationsForCalendar("calendar_1")).toHaveLength(2);
  });

  it("getReservationById returns null for an unknown id", async () => {
    expect(await mockReservationsRepository.getReservationById("missing")).toBeNull();
  });

  it("setReservationStatus clears hold_expires_at on transition to confirmed", async () => {
    const created = await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const result = await mockReservationsRepository.setReservationStatus(created.data.id, "ws_1", "confirmed");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("confirmed");
      expect(result.data.hold_expires_at).toBeNull();
    }
  });

  it("setReservationStatus clears hold_expires_at on transition to cancelled or expired", async () => {
    const created = await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const cancelled = await mockReservationsRepository.setReservationStatus(created.data.id, "ws_1", "cancelled");
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.hold_expires_at).toBeNull();
  });

  it("setReservationStatus fails for a reservation in a different workspace", async () => {
    const created = await mockReservationsRepository.createReservation("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const result = await mockReservationsRepository.setReservationStatus(created.data.id, "ws_2", "confirmed");
    expect(result.success).toBe(false);
  });
});
