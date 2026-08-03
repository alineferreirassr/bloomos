import { describe, expect, it } from "vitest";
import { detectAppointmentConflicts, detectReservationConflicts, buildCapacityConflict, type AppointmentConflictInput, type AppointmentConflictCandidate, type ReservationConflictCandidate } from "@/core/scheduling/conflictEngine";
import type { Appointment, Reservation, CalendarWindow, Holiday } from "@/types/scheduling";

const TZ = "UTC";
const NOW = "2026-08-03T08:00:00.000Z";

function makeCandidate(overrides: Partial<AppointmentConflictCandidate> = {}): AppointmentConflictCandidate {
  return {
    id: "candidate_1",
    calendar_id: "calendar_1",
    workspace_id: "ws_1",
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
    worker_id: null,
    preparation_minutes: 0,
    cleanup_minutes: 0,
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment_other",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    title: "Other Appointment",
    starts_at: "2026-08-03T10:30:00.000Z",
    ends_at: "2026-08-03T11:30:00.000Z",
    status: "confirmed",
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
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput(overrides: Partial<AppointmentConflictInput> = {}): AppointmentConflictInput {
  return {
    candidate: makeCandidate(),
    timeZone: TZ,
    otherAppointments: [],
    calendarWindows: [],
    holidays: [],
    ...overrides,
  };
}

describe("detectAppointmentConflicts — time_overlap", () => {
  it("flags two overlapping appointments on the same calendar", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ otherAppointments: [makeAppointment()] }));
    expect(conflicts.some((c) => c.type === "time_overlap")).toBe(true);
    expect(conflicts.find((c) => c.type === "time_overlap")?.affectedAppointmentIds).toEqual(["appointment_other"]);
  });

  it("does not flag overlapping appointments on different calendars", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ otherAppointments: [makeAppointment({ calendar_id: "calendar_2" })] }));
    expect(conflicts.some((c) => c.type === "time_overlap")).toBe(false);
  });

  it("excludes the candidate's own id from comparison", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ otherAppointments: [makeAppointment({ id: "candidate_1" })] }));
    expect(conflicts.some((c) => c.type === "time_overlap")).toBe(false);
  });

  it("ignores a cancelled appointment", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ otherAppointments: [makeAppointment({ status: "cancelled" })] }));
    expect(conflicts.some((c) => c.type === "time_overlap")).toBe(false);
  });
});

describe("detectAppointmentConflicts — buffer_conflict", () => {
  it("flags a buffer-only collision without also flagging time_overlap", () => {
    const candidate = makeCandidate({ ends_at: "2026-08-03T11:00:00.000Z", cleanup_minutes: 30 });
    const other = makeAppointment({ starts_at: "2026-08-03T11:15:00.000Z", ends_at: "2026-08-03T12:00:00.000Z" });
    const conflicts = detectAppointmentConflicts(baseInput({ candidate, otherAppointments: [other] }));
    expect(conflicts.some((c) => c.type === "buffer_conflict")).toBe(true);
    expect(conflicts.some((c) => c.type === "time_overlap")).toBe(false);
  });
});

describe("detectAppointmentConflicts — worker_conflict", () => {
  it("flags the same worker double-booked across different calendars", () => {
    const candidate = makeCandidate({ worker_id: "worker_1" });
    const other = makeAppointment({ calendar_id: "calendar_2", worker_id: "worker_1" });
    const conflicts = detectAppointmentConflicts(baseInput({ candidate, otherAppointments: [other] }));
    expect(conflicts.some((c) => c.type === "worker_conflict")).toBe(true);
  });

  it("does not flag when the candidate has no worker assigned", () => {
    const other = makeAppointment({ worker_id: "worker_1" });
    const conflicts = detectAppointmentConflicts(baseInput({ otherAppointments: [other] }));
    expect(conflicts.some((c) => c.type === "worker_conflict")).toBe(false);
  });
});

describe("detectAppointmentConflicts — timezone_conflict", () => {
  it("flags an interval spanning more than one local calendar day", () => {
    const candidate = makeCandidate({ starts_at: "2026-08-03T23:00:00.000Z", ends_at: "2026-08-04T01:00:00.000Z" });
    const conflicts = detectAppointmentConflicts(baseInput({ candidate }));
    expect(conflicts.some((c) => c.type === "timezone_conflict")).toBe(true);
  });

  it("does not flag a normal same-day interval", () => {
    const conflicts = detectAppointmentConflicts(baseInput());
    expect(conflicts.some((c) => c.type === "timezone_conflict")).toBe(false);
  });
});

describe("detectAppointmentConflicts — holiday_conflict", () => {
  function makeHoliday(overrides: Partial<Holiday> = {}): Holiday {
    return { id: "holiday_1", workspace_id: "ws_1", name: "Founders Day", scope: "workspace", date: "2026-08-03", recurring: false, emergency: false, time_zone: TZ, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
  }

  it("flags scheduling on a workspace holiday", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ holidays: [makeHoliday()] }));
    const found = conflicts.find((c) => c.type === "holiday_conflict");
    expect(found?.description).toContain("Founders Day");
  });

  it("labels an emergency holiday distinctly", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ holidays: [makeHoliday({ emergency: true })] }));
    const found = conflicts.find((c) => c.type === "holiday_conflict");
    expect(found?.description).toContain("Emergency closure");
  });
});

describe("detectAppointmentConflicts — blackout_conflict", () => {
  function makeWindow(overrides: Partial<CalendarWindow> = {}): CalendarWindow {
    return { id: "window_1", workspace_id: "ws_1", calendar_id: "calendar_1", type: "blocked", starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T12:00:00.000Z", reason: "Equipment maintenance", created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
  }

  it("flags scheduling during a blocked calendar window", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ calendarWindows: [makeWindow()] }));
    const found = conflicts.find((c) => c.type === "blackout_conflict");
    expect(found?.description).toBe("Equipment maintenance");
  });

  it("does not flag an explicit available window", () => {
    const conflicts = detectAppointmentConflicts(baseInput({ calendarWindows: [makeWindow({ type: "available" })] }));
    expect(conflicts.some((c) => c.type === "blackout_conflict")).toBe(false);
  });
});

describe("detectReservationConflicts", () => {
  function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
    return {
      id: "reservation_other",
      workspace_id: "ws_1",
      calendar_id: "calendar_1",
      resource_type: "equipment",
      resource_id: "equipment_1",
      starts_at: "2026-08-03T10:30:00.000Z",
      ends_at: "2026-08-03T11:30:00.000Z",
      status: "confirmed",
      source: "manual",
      priority: "medium",
      hold_expires_at: null,
      appointment_id: "appointment_linked",
      created_by: "member_1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      ...overrides,
    };
  }

  function makeReservationCandidate(overrides: Partial<ReservationConflictCandidate> = {}): ReservationConflictCandidate {
    return { id: "reservation_candidate", resource_type: "equipment", resource_id: "equipment_1", starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", ...overrides };
  }

  it("maps equipment resource_type to equipment_conflict", () => {
    const conflicts = detectReservationConflicts(makeReservationCandidate(), [makeReservation()], NOW);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe("equipment_conflict");
    expect(conflicts[0].affectedReservationIds).toEqual(["reservation_other"]);
    expect(conflicts[0].affectedAppointmentIds).toEqual(["appointment_linked"]);
  });

  it("maps vehicle resource_type to vehicle_conflict", () => {
    const candidate = makeReservationCandidate({ resource_type: "vehicle", resource_id: "vehicle_1" });
    const existing = [makeReservation({ resource_type: "vehicle", resource_id: "vehicle_1" })];
    expect(detectReservationConflicts(candidate, existing, NOW)[0].type).toBe("vehicle_conflict");
  });

  it("maps worker resource_type to worker_conflict", () => {
    const candidate = makeReservationCandidate({ resource_type: "worker", resource_id: "worker_1" });
    const existing = [makeReservation({ resource_type: "worker", resource_id: "worker_1" })];
    expect(detectReservationConflicts(candidate, existing, NOW)[0].type).toBe("worker_conflict");
  });

  it("maps asset resource_type to resource_overlap", () => {
    const candidate = makeReservationCandidate({ resource_type: "asset", resource_id: "asset_1" });
    const existing = [makeReservation({ resource_type: "asset", resource_id: "asset_1" })];
    expect(detectReservationConflicts(candidate, existing, NOW)[0].type).toBe("resource_overlap");
  });

  it("ignores an expired hold", () => {
    const existing = [makeReservation({ status: "held", hold_expires_at: "2026-08-03T07:00:00.000Z" })];
    expect(detectReservationConflicts(makeReservationCandidate(), existing, NOW)).toHaveLength(0);
  });

  it("ignores a non-overlapping reservation", () => {
    const existing = [makeReservation({ starts_at: "2026-08-03T12:00:00.000Z", ends_at: "2026-08-03T13:00:00.000Z" })];
    expect(detectReservationConflicts(makeReservationCandidate(), existing, NOW)).toHaveLength(0);
  });
});

describe("buildCapacityConflict", () => {
  it("builds a capacity_conflict describing the breach", () => {
    const conflict = buildCapacityConflict({ scope: "team", scopeId: "team_1", currentUsage: 2, maxConcurrent: 2 });
    expect(conflict.type).toBe("capacity_conflict");
    expect(conflict.description).toContain("2");
  });
});
