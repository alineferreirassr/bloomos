import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockRecurrenceRulesRepository, resetRecurrenceRulesStore, type CreateRecurrenceRuleInput } from "@/lib/data/mock/recurrenceRulesStore";

const baseInput: CreateRecurrenceRuleInput = {
  frequency: "weekly",
  interval: 1,
  days_of_week: [1],
  day_of_month: null,
  nth_weekday: null,
  end_date: null,
  occurrence_count: null,
  exception_dates: [],
};

beforeEach(() => resetRecurrenceRulesStore());
afterEach(() => resetRecurrenceRulesStore());

describe("mockRecurrenceRulesRepository", () => {
  it("creates a rule", async () => {
    const result = await mockRecurrenceRulesRepository.createRule("ws_1", baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects an interval below 1", async () => {
    const result = await mockRecurrenceRulesRepository.createRule("ws_1", { ...baseInput, interval: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects both day_of_month and nth_weekday set together", async () => {
    const result = await mockRecurrenceRulesRepository.createRule("ws_1", { ...baseInput, day_of_month: 15, nth_weekday: { week: 2, weekday: 2 } });
    expect(result.success).toBe(false);
  });

  it("getRuleById returns null for an unknown id, and the created rule by id", async () => {
    expect(await mockRecurrenceRulesRepository.getRuleById("missing")).toBeNull();
    const created = await mockRecurrenceRulesRepository.createRule("ws_1", baseInput);
    if (!created.success) throw new Error("setup failed");
    expect((await mockRecurrenceRulesRepository.getRuleById(created.data.id))?.id).toBe(created.data.id);
  });
});
