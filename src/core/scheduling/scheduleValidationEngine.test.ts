import { describe, expect, it } from "vitest";
import { validateAppointmentSchedule } from "@/core/scheduling/scheduleValidationEngine";
import type { AppointmentConflictInput, AppointmentConflictCandidate } from "@/core/scheduling/conflictEngine";
import type { Appointment } from "@/types/scheduling";

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

function baseInput(overrides: Partial<AppointmentConflictInput> = {}): AppointmentConflictInput {
  return {
    candidate: makeCandidate(),
    timeZone: "UTC",
    otherAppointments: [],
    calendarWindows: [],
    holidays: [],
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

describe("validateAppointmentSchedule", () => {
  it("is valid for a clean appointment with no conflicts", () => {
    const result = validateAppointmentSchedule("Consultation", baseInput());
    expect(result).toEqual({ valid: true, errors: [], warnings: [], conflicts: [] });
  });

  it("rejects a missing title", () => {
    const result = validateAppointmentSchedule("   ", baseInput());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "title_required")).toBe(true);
  });

  it("rejects an interval where ends_at is not after starts_at", () => {
    const result = validateAppointmentSchedule("Consultation", baseInput({ candidate: makeCandidate({ ends_at: "2026-08-03T10:00:00.000Z" }) }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "invalid_interval")).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it("rejects negative buffer minutes", () => {
    const result = validateAppointmentSchedule("Consultation", baseInput({ candidate: makeCandidate({ preparation_minutes: -5 }) }));
    expect(result.errors.some((e) => e.rule === "invalid_buffer")).toBe(true);
  });

  it("treats a high-severity conflict as a blocking error", () => {
    const result = validateAppointmentSchedule("Consultation", baseInput({ otherAppointments: [makeAppointment()] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "time_overlap")).toBe(true);
    expect(result.conflicts.some((c) => c.type === "time_overlap")).toBe(true);
  });

  it("treats a medium-severity conflict as a non-blocking warning", () => {
    const candidate = makeCandidate({ starts_at: "2026-08-03T23:00:00.000Z", ends_at: "2026-08-04T01:00:00.000Z" });
    const result = validateAppointmentSchedule("Consultation", baseInput({ candidate }));
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.rule === "timezone_conflict")).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
