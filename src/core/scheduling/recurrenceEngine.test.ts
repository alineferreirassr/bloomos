import { describe, expect, it } from "vitest";
import { generateOccurrenceDates, isOccurrenceDate, MAX_OCCURRENCES_SAFETY_CAP } from "@/core/scheduling/recurrenceEngine";
import type { RecurrenceRule } from "@/types/scheduling";

function makeRule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    id: "recurrence_rule_1",
    workspace_id: "ws_1",
    frequency: "daily",
    interval: 1,
    days_of_week: null,
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

describe("generateOccurrenceDates — daily", () => {
  it("generates every Nth day within the range", () => {
    const rule = makeRule({ frequency: "daily", interval: 2 });
    expect(generateOccurrenceDates(rule, "2026-08-01", "2026-08-01", "2026-08-08")).toEqual(["2026-08-01", "2026-08-03", "2026-08-05", "2026-08-07"]);
  });

  it("respects occurrence_count counted from the seed date, not the query range", () => {
    const rule = makeRule({ frequency: "daily", occurrence_count: 3 });
    expect(generateOccurrenceDates(rule, "2026-08-01", "2026-08-02", "2026-08-10")).toEqual(["2026-08-02", "2026-08-03"]);
  });

  it("respects end_date", () => {
    const rule = makeRule({ frequency: "daily", end_date: "2026-08-03" });
    expect(generateOccurrenceDates(rule, "2026-08-01", "2026-08-01", "2026-08-10")).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("excludes exception_dates", () => {
    const rule = makeRule({ frequency: "daily", exception_dates: ["2026-08-02"] });
    expect(generateOccurrenceDates(rule, "2026-08-01", "2026-08-01", "2026-08-03")).toEqual(["2026-08-01", "2026-08-03"]);
  });

  it("returns nothing when the range is entirely before the seed date", () => {
    const rule = makeRule({ frequency: "daily" });
    expect(generateOccurrenceDates(rule, "2026-08-10", "2026-08-01", "2026-08-05")).toEqual([]);
  });
});

describe("generateOccurrenceDates — weekly", () => {
  it("expands into every matched weekday, every interval-th week", () => {
    const rule = makeRule({ frequency: "weekly", interval: 1, days_of_week: [1, 3] });
    // 2026-08-03 is a Monday.
    expect(generateOccurrenceDates(rule, "2026-08-03", "2026-08-03", "2026-08-16")).toEqual(["2026-08-03", "2026-08-05", "2026-08-10", "2026-08-12"]);
  });

  it("skips whole weeks when interval is 2", () => {
    const rule = makeRule({ frequency: "weekly", interval: 2, days_of_week: [1] });
    expect(generateOccurrenceDates(rule, "2026-08-03", "2026-08-03", "2026-08-24")).toEqual(["2026-08-03", "2026-08-17"]);
  });

  it("never produces an occurrence before the seed date within its own seed week", () => {
    // Seed is Wednesday 2026-08-05; Monday of that same week (08-03) must not appear.
    const rule = makeRule({ frequency: "weekly", interval: 1, days_of_week: [1, 3] });
    expect(generateOccurrenceDates(rule, "2026-08-05", "2026-08-01", "2026-08-09")).toEqual(["2026-08-05"]);
  });
});

describe("generateOccurrenceDates — monthly", () => {
  it("fixed day_of_month, every month", () => {
    const rule = makeRule({ frequency: "monthly", day_of_month: 15 });
    expect(generateOccurrenceDates(rule, "2026-01-15", "2026-01-01", "2026-04-01")).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("clamps day_of_month to the last day of a shorter month", () => {
    const rule = makeRule({ frequency: "monthly", day_of_month: 31 });
    expect(generateOccurrenceDates(rule, "2026-01-31", "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("nth_weekday resolves e.g. the 2nd Tuesday of each month", () => {
    // 2026-01-13 is the 2nd Tuesday of January 2026.
    const rule = makeRule({ frequency: "monthly", nth_weekday: { week: 2, weekday: 2 } });
    expect(generateOccurrenceDates(rule, "2026-01-13", "2026-01-01", "2026-03-01")).toEqual(["2026-01-13", "2026-02-10"]);
  });

  it("nth_weekday week: -1 resolves the last matching weekday of the month", () => {
    // 2026-01-30 is the last Friday of January 2026.
    const rule = makeRule({ frequency: "monthly", nth_weekday: { week: -1, weekday: 5 } });
    expect(generateOccurrenceDates(rule, "2026-01-30", "2026-01-01", "2026-02-28")).toEqual(["2026-01-30", "2026-02-27"]);
  });
});

describe("generateOccurrenceDates — yearly", () => {
  it("repeats the same month/day every interval-th year", () => {
    const rule = makeRule({ frequency: "yearly", interval: 1 });
    expect(generateOccurrenceDates(rule, "2026-03-15", "2026-01-01", "2029-01-01")).toEqual(["2026-03-15", "2027-03-15", "2028-03-15"]);
  });

  it("clamps a Feb 29 seed to Feb 28 in a non-leap year", () => {
    const rule = makeRule({ frequency: "yearly", interval: 1 });
    expect(generateOccurrenceDates(rule, "2024-02-29", "2025-01-01", "2025-12-31")).toEqual(["2025-02-28"]);
  });
});

describe("isOccurrenceDate", () => {
  it("returns true for a date the rule actually lands on", () => {
    const rule = makeRule({ frequency: "weekly", days_of_week: [1] });
    expect(isOccurrenceDate(rule, "2026-08-03", "2026-08-10")).toBe(true);
  });

  it("returns false for a date the rule does not land on", () => {
    const rule = makeRule({ frequency: "weekly", days_of_week: [1] });
    expect(isOccurrenceDate(rule, "2026-08-03", "2026-08-11")).toBe(false);
  });

  it("returns false for a date before the seed", () => {
    const rule = makeRule({ frequency: "daily" });
    expect(isOccurrenceDate(rule, "2026-08-03", "2026-08-01")).toBe(false);
  });
});

describe("safety cap", () => {
  it("bounds generation even for an unbounded rule queried over a huge range", () => {
    const rule = makeRule({ frequency: "daily", interval: 1 });
    const result = generateOccurrenceDates(rule, "2000-01-01", "2000-01-01", "2100-01-01");
    expect(result.length).toBeLessThanOrEqual(MAX_OCCURRENCES_SAFETY_CAP);
  });
});
