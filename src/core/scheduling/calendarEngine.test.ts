import { describe, expect, it } from "vitest";
import { buildCalendarView } from "@/core/scheduling/calendarEngine";
import type { Appointment, RecurrenceRule } from "@/types/scheduling";

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    title: "Consultation",
    starts_at: "2026-08-03T09:00:00.000Z",
    ends_at: "2026-08-03T10:00:00.000Z",
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

function makeRecurrenceRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    id: "recurrence_rule_1",
    workspace_id: "ws_1",
    frequency: "weekly",
    interval: 1,
    days_of_week: [1],
    day_of_month: null,
    nth_weekday: null,
    end_date: null,
    occurrence_count: null,
    exception_dates: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCalendarView", () => {
  it("includes a non-recurring appointment that overlaps the range", () => {
    const view = buildCalendarView("calendar_1", "weekly", "2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z", [makeAppointment()], []);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0]).toMatchObject({ isRecurringInstance: false, recurrenceRuleId: null });
  });

  it("excludes an appointment outside the range", () => {
    const view = buildCalendarView("calendar_1", "weekly", "2026-09-01T00:00:00.000Z", "2026-09-07T00:00:00.000Z", [makeAppointment()], []);
    expect(view.entries).toHaveLength(0);
  });

  it("excludes appointments belonging to a different calendar", () => {
    const view = buildCalendarView("calendar_1", "weekly", "2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z", [makeAppointment({ calendar_id: "calendar_2" })], []);
    expect(view.entries).toHaveLength(0);
  });

  it("excludes cancelled appointments", () => {
    const view = buildCalendarView("calendar_1", "weekly", "2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z", [makeAppointment({ status: "cancelled" })], []);
    expect(view.entries).toHaveLength(0);
  });

  it("expands a recurring appointment into virtual entries for every generated occurrence", () => {
    // Monday 2026-08-03 seed, weekly on Mondays, queried across three weeks.
    const appointment = makeAppointment({ recurrence_rule_id: "recurrence_rule_1" });
    const rule = makeRecurrenceRule();
    const view = buildCalendarView("calendar_1", "monthly", "2026-08-03T00:00:00.000Z", "2026-08-17T00:00:00.000Z", [appointment], [rule]);
    expect(view.entries).toHaveLength(3);
    expect(view.entries[0]).toMatchObject({ isRecurringInstance: false, recurrenceRuleId: "recurrence_rule_1" });
    expect(view.entries[0].appointment.starts_at).toBe("2026-08-03T09:00:00.000Z");
    expect(view.entries[1]).toMatchObject({ isRecurringInstance: true, recurrenceRuleId: "recurrence_rule_1" });
    expect(view.entries[1].appointment.starts_at).toBe("2026-08-10T09:00:00.000Z");
    expect(view.entries[1].appointment.ends_at).toBe("2026-08-10T10:00:00.000Z");
    expect(view.entries[2].appointment.starts_at).toBe("2026-08-17T09:00:00.000Z");
  });

  it("preserves the original appointment's other fields on a virtual recurring instance", () => {
    const appointment = makeAppointment({ recurrence_rule_id: "recurrence_rule_1", title: "Weekly Sync", notes: "Bring the contract draft" });
    const rule = makeRecurrenceRule();
    const view = buildCalendarView("calendar_1", "monthly", "2026-08-10T00:00:00.000Z", "2026-08-10T23:59:59.999Z", [appointment], [rule]);
    expect(view.entries[0].appointment.title).toBe("Weekly Sync");
    expect(view.entries[0].appointment.notes).toBe("Bring the contract draft");
    expect(view.entries[0].appointment.id).toBe(appointment.id);
  });

  it("falls back to a single non-recurring entry when recurrence_rule_id points at a missing rule", () => {
    const view = buildCalendarView("calendar_1", "weekly", "2026-08-03T00:00:00.000Z", "2026-08-09T00:00:00.000Z", [makeAppointment({ recurrence_rule_id: "missing_rule" })], []);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].isRecurringInstance).toBe(false);
  });

  it("sorts entries chronologically", () => {
    const later = makeAppointment({ id: "appointment_2", starts_at: "2026-08-05T09:00:00.000Z", ends_at: "2026-08-05T10:00:00.000Z" });
    const earlier = makeAppointment({ id: "appointment_1", starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T10:00:00.000Z" });
    const view = buildCalendarView("calendar_1", "weekly", "2026-08-01T00:00:00.000Z", "2026-08-09T00:00:00.000Z", [later, earlier], []);
    expect(view.entries.map((e) => e.appointment.id)).toEqual(["appointment_1", "appointment_2"]);
  });
});
