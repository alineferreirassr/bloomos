import { describe, expect, it } from "vitest";
import { resolveApplicableWorkingHoursRule, isWithinWorkingHours } from "@/core/scheduling/workingHoursEngine";
import type { WorkingHoursRule } from "@/types/scheduling";

function makeRule(overrides: Partial<WorkingHoursRule> = {}): WorkingHoursRule {
  return {
    id: "working_hours_rule_1",
    workspace_id: "ws_1",
    calendar_id: "calendar_1",
    kind: "regular",
    day_of_week: 1,
    specific_date: null,
    starts_time: "09:00",
    ends_time: "17:00",
    time_zone: "America/Sao_Paulo",
    is_closed: false,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveApplicableWorkingHoursRule", () => {
  it("matches a day-of-week rule when no specific-date rule exists", () => {
    const rules = [makeRule({ id: "r1", day_of_week: 1 })];
    expect(resolveApplicableWorkingHoursRule(rules, "calendar_1", "2026-08-03", 1)?.id).toBe("r1");
  });

  it("returns null when no rule matches the calendar, date, or weekday", () => {
    const rules = [makeRule({ id: "r1", day_of_week: 2 })];
    expect(resolveApplicableWorkingHoursRule(rules, "calendar_1", "2026-08-03", 1)).toBeNull();
  });

  it("ignores rules belonging to a different calendar", () => {
    const rules = [makeRule({ id: "r1", calendar_id: "calendar_2", day_of_week: 1 })];
    expect(resolveApplicableWorkingHoursRule(rules, "calendar_1", "2026-08-03", 1)).toBeNull();
  });

  it("a specific-date rule always beats a day-of-week rule regardless of kind", () => {
    const rules = [
      makeRule({ id: "regular", kind: "temporary_override", day_of_week: 1, specific_date: null }),
      makeRule({ id: "override", kind: "regular", day_of_week: null, specific_date: "2026-08-03" }),
    ];
    expect(resolveApplicableWorkingHoursRule(rules, "calendar_1", "2026-08-03", 1)?.id).toBe("override");
  });

  it("breaks ties among same-specificity rules by kind priority", () => {
    const rules = [
      makeRule({ id: "regular", kind: "regular", day_of_week: 1 }),
      makeRule({ id: "custom", kind: "custom", day_of_week: 1 }),
    ];
    expect(resolveApplicableWorkingHoursRule(rules, "calendar_1", "2026-08-03", 1)?.id).toBe("custom");
  });
});

describe("isWithinWorkingHours", () => {
  it("resolves closed with no rule when nothing matches", () => {
    const result = isWithinWorkingHours([], "calendar_1", "2026-08-03", 1, "10:00");
    expect(result).toEqual({ isOpen: false, rule: null });
  });

  it("resolves open when local time falls within the matched rule's window", () => {
    const rules = [makeRule()];
    const result = isWithinWorkingHours(rules, "calendar_1", "2026-08-03", 1, "10:00");
    expect(result.isOpen).toBe(true);
    expect(result.rule?.id).toBe("working_hours_rule_1");
  });

  it("resolves closed when local time falls before the window starts", () => {
    const rules = [makeRule()];
    expect(isWithinWorkingHours(rules, "calendar_1", "2026-08-03", 1, "08:00").isOpen).toBe(false);
  });

  it("resolves closed when local time falls at or after the window ends", () => {
    const rules = [makeRule()];
    expect(isWithinWorkingHours(rules, "calendar_1", "2026-08-03", 1, "17:00").isOpen).toBe(false);
  });

  it("resolves closed when the matched rule is is_closed regardless of times", () => {
    const rules = [makeRule({ kind: "weekend", day_of_week: 0, is_closed: true, starts_time: "00:00", ends_time: "00:00" })];
    const result = isWithinWorkingHours(rules, "calendar_1", "2026-08-02", 0, "10:00");
    expect(result.isOpen).toBe(false);
    expect(result.rule?.is_closed).toBe(true);
  });
});
