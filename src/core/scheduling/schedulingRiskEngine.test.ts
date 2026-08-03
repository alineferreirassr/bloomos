import { describe, expect, it } from "vitest";
import { detectSchedulingRisks, type DetectSchedulingRisksInput, type CalendarScoreEntry } from "@/core/scheduling/schedulingRiskEngine";
import type { Calendar, Appointment, Reservation, CapacityRule, SchedulingScores } from "@/types/scheduling";

const NOW = "2026-08-03T08:00:00.000Z";

function makeCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return { id: "calendar_1", workspace_id: "ws_1", name: "Main Calendar", description: null, context_type: "workspace", context: null, time_zone: "UTC", status: "active", created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null, ...overrides };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    title: "Consultation",
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
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

const PERFECT_SCORES: SchedulingScores = { windowQualityScore: 100, bufferQualityScore: 100, capacityUtilizationScore: 100, conflictSeverityScore: 100, scheduleDensityScore: 50, calendarHealthScore: 90 };

function makeScoreEntry(overrides: Partial<CalendarScoreEntry> = {}): CalendarScoreEntry {
  return { calendarId: "calendar_1", calendarName: "Main Calendar", scores: PERFECT_SCORES, rawDensityRatio: 0.5, ...overrides };
}

function baseInput(overrides: Partial<DetectSchedulingRisksInput> = {}): DetectSchedulingRisksInput {
  return {
    calendars: [makeCalendar()],
    appointments: [],
    reservations: [],
    calendarWindows: [],
    holidays: [],
    workingHoursRules: [{ id: "wh_1", workspace_id: "ws_1", calendar_id: "calendar_1", kind: "regular", day_of_week: 1, specific_date: null, starts_time: "00:00", ends_time: "23:59", time_zone: "UTC", is_closed: false, created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
    recurrenceRules: [],
    capacityChecks: [],
    calendarScores: [makeScoreEntry()],
    now: NOW,
    ...overrides,
  };
}

describe("detectSchedulingRisks — overbooked_schedule", () => {
  it("flags a calendar whose raw density ratio exceeds 1", () => {
    const findings = detectSchedulingRisks(baseInput({ calendarScores: [makeScoreEntry({ rawDensityRatio: 1.2 })] }));
    expect(findings.some((f) => f.type === "overbooked_schedule")).toBe(true);
  });

  it("does not flag a calendar at or below capacity", () => {
    const findings = detectSchedulingRisks(baseInput({ calendarScores: [makeScoreEntry({ rawDensityRatio: 1 })] }));
    expect(findings.some((f) => f.type === "overbooked_schedule")).toBe(false);
  });
});

describe("detectSchedulingRisks — unavailable_time_window", () => {
  it("flags an appointment outside the calendar's working hours", () => {
    const appointments = [makeAppointment()];
    const findings = detectSchedulingRisks(baseInput({ appointments, workingHoursRules: [] }));
    expect(findings.some((f) => f.type === "unavailable_time_window" && f.relatedAppointmentId === "appointment_1")).toBe(true);
  });

  it("does not flag an appointment within working hours", () => {
    const appointments = [makeAppointment()];
    const findings = detectSchedulingRisks(baseInput({ appointments }));
    expect(findings.some((f) => f.type === "unavailable_time_window")).toBe(false);
  });
});

describe("detectSchedulingRisks — capacity_exhausted", () => {
  function makeCapacityRule(overrides: Partial<CapacityRule> = {}): CapacityRule {
    return { id: "capacity_rule_1", workspace_id: "ws_1", scope: "team", scope_id: "team_1", window: "time_window", max_concurrent: 2, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
  }

  it("flags a rule whose current usage has met or exceeded max_concurrent", () => {
    const findings = detectSchedulingRisks(baseInput({ capacityChecks: [{ rule: makeCapacityRule(), currentUsage: 2 }] }));
    expect(findings.some((f) => f.type === "capacity_exhausted")).toBe(true);
  });

  it("does not flag a rule with room to spare", () => {
    const findings = detectSchedulingRisks(baseInput({ capacityChecks: [{ rule: makeCapacityRule(), currentUsage: 1 }] }));
    expect(findings.some((f) => f.type === "capacity_exhausted")).toBe(false);
  });
});

describe("detectSchedulingRisks — recurring_conflict", () => {
  it("flags a recurring appointment whose future occurrence collides with another appointment", () => {
    const recurring = makeAppointment({ id: "recurring_1", recurrence_rule_id: "recurrence_rule_1" });
    // 2026-08-10 is one week after the seed (2026-08-03), matching the weekly rule.
    const blocker = makeAppointment({ id: "blocker_1", starts_at: "2026-08-10T10:00:00.000Z", ends_at: "2026-08-10T11:00:00.000Z" });
    const rule = { id: "recurrence_rule_1", workspace_id: "ws_1", frequency: "weekly" as const, interval: 1, days_of_week: [1], day_of_month: null, nth_weekday: null, end_date: null, occurrence_count: null, exception_dates: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
    const findings = detectSchedulingRisks(baseInput({ appointments: [recurring, blocker], recurrenceRules: [rule] }));
    expect(findings.some((f) => f.type === "recurring_conflict" && f.relatedAppointmentId === "recurring_1")).toBe(true);
  });

  it("does not flag a recurring appointment with no future collisions", () => {
    const recurring = makeAppointment({ id: "recurring_1", recurrence_rule_id: "recurrence_rule_1" });
    const rule = { id: "recurrence_rule_1", workspace_id: "ws_1", frequency: "weekly" as const, interval: 1, days_of_week: [1], day_of_month: null, nth_weekday: null, end_date: null, occurrence_count: null, exception_dates: [], created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
    const findings = detectSchedulingRisks(baseInput({ appointments: [recurring], recurrenceRules: [rule] }));
    expect(findings.some((f) => f.type === "recurring_conflict")).toBe(false);
  });
});

describe("detectSchedulingRisks — holiday_conflict", () => {
  it("flags an appointment scheduled on a holiday", () => {
    const holidays = [{ id: "holiday_1", workspace_id: "ws_1", name: "Founders Day", scope: "workspace" as const, date: "2026-08-03", recurring: false, emergency: false, time_zone: "UTC", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }];
    const findings = detectSchedulingRisks(baseInput({ appointments: [makeAppointment()], holidays }));
    expect(findings.some((f) => f.type === "holiday_conflict")).toBe(true);
  });
});

describe("detectSchedulingRisks — reservation_expiration", () => {
  function makeReservation(overrides: Partial<Reservation> = {}): Reservation {
    return { id: "reservation_1", workspace_id: "ws_1", calendar_id: "calendar_1", resource_type: "equipment", resource_id: "equipment_1", starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", status: "held", source: "manual", priority: "medium", hold_expires_at: "2026-08-03T08:10:00.000Z", appointment_id: null, created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
  }

  it("flags a hold expiring soon", () => {
    const findings = detectSchedulingRisks(baseInput({ reservations: [makeReservation()] }));
    expect(findings.some((f) => f.type === "reservation_expiration" && f.relatedReservationId === "reservation_1")).toBe(true);
  });

  it("flags an already-expired hold", () => {
    const findings = detectSchedulingRisks(baseInput({ reservations: [makeReservation({ hold_expires_at: "2026-08-03T07:00:00.000Z" })] }));
    expect(findings.some((f) => f.type === "reservation_expiration")).toBe(true);
  });

  it("does not flag a hold with plenty of time left", () => {
    const findings = detectSchedulingRisks(baseInput({ reservations: [makeReservation({ hold_expires_at: "2026-08-03T12:00:00.000Z" })] }));
    expect(findings.some((f) => f.type === "reservation_expiration")).toBe(false);
  });

  it("does not flag a confirmed reservation", () => {
    const findings = detectSchedulingRisks(baseInput({ reservations: [makeReservation({ status: "confirmed" })] }));
    expect(findings.some((f) => f.type === "reservation_expiration")).toBe(false);
  });
});

describe("detectSchedulingRisks — calendar_health", () => {
  it("flags a calendar below the health threshold", () => {
    const findings = detectSchedulingRisks(baseInput({ calendarScores: [makeScoreEntry({ scores: { ...PERFECT_SCORES, calendarHealthScore: 50 } })] }));
    expect(findings.some((f) => f.type === "calendar_health")).toBe(true);
  });

  it("does not flag a healthy calendar", () => {
    const findings = detectSchedulingRisks(baseInput());
    expect(findings.some((f) => f.type === "calendar_health")).toBe(false);
  });
});
