import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockWorkingHoursRepository, resetWorkingHoursStore, type CreateWorkingHoursRuleInput } from "@/lib/data/mock/workingHoursStore";

const baseInput: CreateWorkingHoursRuleInput = {
  calendar_id: "calendar_1",
  kind: "regular",
  day_of_week: 1,
  specific_date: null,
  starts_time: "09:00",
  ends_time: "17:00",
  time_zone: "UTC",
  is_closed: false,
};

beforeEach(() => resetWorkingHoursStore());
afterEach(() => resetWorkingHoursStore());

describe("mockWorkingHoursRepository", () => {
  it("creates a rule", async () => {
    const result = await mockWorkingHoursRepository.createRule("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects ends_time not after starts_time when not closed", async () => {
    const result = await mockWorkingHoursRepository.createRule("ws_1", "member_1", { ...baseInput, ends_time: baseInput.starts_time });
    expect(result.success).toBe(false);
  });

  it("allows equal starts/ends time when is_closed", async () => {
    const result = await mockWorkingHoursRepository.createRule("ws_1", "member_1", { ...baseInput, is_closed: true, starts_time: "00:00", ends_time: "00:00" });
    expect(result.success).toBe(true);
  });

  it("listRulesForCalendar scopes to the calendar", async () => {
    await mockWorkingHoursRepository.createRule("ws_1", "member_1", baseInput);
    await mockWorkingHoursRepository.createRule("ws_1", "member_1", { ...baseInput, calendar_id: "calendar_2" });
    expect(await mockWorkingHoursRepository.listRulesForCalendar("calendar_1")).toHaveLength(1);
  });
});
