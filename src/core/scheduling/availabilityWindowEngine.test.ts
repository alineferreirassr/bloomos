import { describe, expect, it } from "vitest";
import { resolveAvailabilityForInterval, type AvailabilityWindowInput } from "@/core/scheduling/availabilityWindowEngine";
import type { WorkingHoursRule, CalendarWindow, Holiday } from "@/types/scheduling";

const TZ = "UTC";

function makeWorkingHoursRule(overrides: Partial<WorkingHoursRule> = {}): WorkingHoursRule {
  return {
    id: "working_hours_rule_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    kind: "regular",
    day_of_week: 1,
    specific_date: null,
    starts_time: "09:00",
    ends_time: "17:00",
    time_zone: TZ,
    is_closed: false,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCalendarWindow(overrides: Partial<CalendarWindow> = {}): CalendarWindow {
  return {
    id: "calendar_window_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    type: "blocked",
    starts_at: "2026-08-03T13:00:00.000Z",
    ends_at: "2026-08-03T14:00:00.000Z",
    reason: "Equipment maintenance",
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: "holiday_1",
    workspace_id: "ws_1",
    name: "Independence Day",
    scope: "workspace",
    date: "2026-08-03",
    recurring: false,
    emergency: false,
    time_zone: TZ,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput(overrides: Partial<AvailabilityWindowInput> = {}): AvailabilityWindowInput {
  return {
    calendarId: "calendar_1",
    workspaceId: "ws_1",
    timeZone: TZ,
    starts_at: "2026-08-03T10:00:00.000Z",
    ends_at: "2026-08-03T11:00:00.000Z",
    workingHoursRules: [makeWorkingHoursRule()],
    calendarWindows: [],
    holidays: [],
    ...overrides,
  };
}

describe("resolveAvailabilityForInterval", () => {
  it("is available when the interval falls fully within working hours", () => {
    expect(resolveAvailabilityForInterval(baseInput())).toEqual({ available: true, reason: null });
  });

  it("is unavailable when there is no working hours rule for that day", () => {
    const result = resolveAvailabilityForInterval(baseInput({ workingHoursRules: [] }));
    expect(result.available).toBe(false);
    expect(result.reason).toBe("No working hours configured for this day");
  });

  it("is unavailable when the matched rule is marked closed", () => {
    const result = resolveAvailabilityForInterval(baseInput({ workingHoursRules: [makeWorkingHoursRule({ is_closed: true })] }));
    expect(result.available).toBe(false);
    expect(result.reason).toBe("Calendar is closed on this day");
  });

  it("is unavailable when the interval starts before working hours open", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T08:00:00.000Z", ends_at: "2026-08-03T08:30:00.000Z" }));
    expect(result.available).toBe(false);
    expect(result.reason).toBe("Outside working hours");
  });

  it("is unavailable when a blocking calendar window overlaps the interval", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z", calendarWindows: [makeCalendarWindow()] }));
    expect(result).toEqual({ available: false, reason: "Equipment maintenance" });
  });

  it("uses a generic label when a blocking window has no reason text", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z", calendarWindows: [makeCalendarWindow({ reason: null, type: "maintenance" })] }));
    expect(result.reason).toBe("Blocked (maintenance)");
  });

  it("is available when an explicit available window fully covers the interval, even outside working hours", () => {
    const result = resolveAvailabilityForInterval(
      baseInput({
        starts_at: "2026-08-01T13:00:00.000Z",
        ends_at: "2026-08-01T14:00:00.000Z",
        calendarWindows: [makeCalendarWindow({ type: "available", starts_at: "2026-08-01T12:00:00.000Z", ends_at: "2026-08-01T15:00:00.000Z", reason: null })],
      }),
    );
    expect(result).toEqual({ available: true, reason: null });
  });

  it("is unavailable on a holiday", () => {
    const result = resolveAvailabilityForInterval(baseInput({ holidays: [makeHoliday()] }));
    expect(result).toEqual({ available: false, reason: "Holiday: Independence Day" });
  });

  it("an emergency holiday takes precedence even over an explicit available override", () => {
    const result = resolveAvailabilityForInterval(
      baseInput({
        holidays: [makeHoliday({ emergency: true })],
        calendarWindows: [makeCalendarWindow({ type: "available", starts_at: "2026-08-03T09:00:00.000Z", ends_at: "2026-08-03T17:00:00.000Z", reason: null })],
      }),
    );
    expect(result).toEqual({ available: false, reason: "Emergency closure: Independence Day" });
  });

  it("rejects an interval spanning more than one local calendar day", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T23:00:00.000Z", ends_at: "2026-08-04T01:00:00.000Z" }));
    expect(result.available).toBe(false);
    expect(result.reason).toContain("does not yet support");
  });

  it("ignores calendar windows scoped to a different calendar", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z", calendarWindows: [makeCalendarWindow({ calendar_id: "calendar_2" })] }));
    expect(result.available).toBe(true);
  });

  it("applies a workspace-wide window (calendar_id: null) to every calendar", () => {
    const result = resolveAvailabilityForInterval(baseInput({ starts_at: "2026-08-03T13:30:00.000Z", ends_at: "2026-08-03T14:30:00.000Z", calendarWindows: [makeCalendarWindow({ calendar_id: null })] }));
    expect(result.available).toBe(false);
  });
});
