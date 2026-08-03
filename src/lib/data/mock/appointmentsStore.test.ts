import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockAppointmentsRepository, resetAppointmentsStore, type CreateAppointmentInput } from "@/lib/data/mock/appointmentsStore";

const baseInput: CreateAppointmentInput = {
  calendar_id: "calendar_1",
  title: "Consultation",
  starts_at: "2026-08-03T10:00:00.000Z",
  ends_at: "2026-08-03T11:00:00.000Z",
  priority: "medium",
  context_type: "custom",
  context: null,
  client_id: null,
  worker_id: null,
  location_placeholder: null,
  preparation_minutes: 0,
  cleanup_minutes: 0,
  notes: null,
  recurrence_rule_id: null,
};

beforeEach(() => resetAppointmentsStore());
afterEach(() => resetAppointmentsStore());

describe("mockAppointmentsRepository", () => {
  it("creates an appointment as tentative", async () => {
    const result = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("tentative");
  });

  it("rejects a blank title", async () => {
    const result = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", { ...baseInput, title: " " });
    expect(result.success).toBe(false);
  });

  it("rejects ends_at not after starts_at", async () => {
    const result = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", { ...baseInput, ends_at: baseInput.starts_at });
    expect(result.success).toBe(false);
  });

  it("listAppointmentsForWorkspace scopes to the workspace", async () => {
    await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    await mockAppointmentsRepository.createAppointment("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });
    await mockAppointmentsRepository.createAppointment("ws_2", "member_1", baseInput);

    expect(await mockAppointmentsRepository.listAppointmentsForWorkspace("ws_1")).toHaveLength(2);
  });

  it("listAppointmentsForCalendar scopes to the calendar only — workspace scoping is the caller's job", async () => {
    await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    await mockAppointmentsRepository.createAppointment("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });
    await mockAppointmentsRepository.createAppointment("ws_2", "member_1", baseInput);

    expect(await mockAppointmentsRepository.listAppointmentsForCalendar("calendar_1")).toHaveLength(2);
  });

  it("getAppointmentById returns null for an unknown id", async () => {
    expect(await mockAppointmentsRepository.getAppointmentById("missing")).toBeNull();
  });

  it("updateAppointment merges fields and re-validates the interval", async () => {
    const created = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");

    const updated = await mockAppointmentsRepository.updateAppointment(created.data.id, "ws_1", { title: "Updated" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.title).toBe("Updated");

    const invalid = await mockAppointmentsRepository.updateAppointment(created.data.id, "ws_1", { starts_at: "2026-08-03T12:00:00.000Z" });
    expect(invalid.success).toBe(false);
  });

  it("updateAppointment fails for an appointment in a different workspace", async () => {
    const created = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const result = await mockAppointmentsRepository.updateAppointment(created.data.id, "ws_2", { title: "Nope" });
    expect(result.success).toBe(false);
  });

  it("setAppointmentStatus transitions status", async () => {
    const created = await mockAppointmentsRepository.createAppointment("ws_1", "member_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    const result = await mockAppointmentsRepository.setAppointmentStatus(created.data.id, "ws_1", "cancelled");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("cancelled");
  });
});
