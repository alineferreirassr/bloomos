import { describe, expect, it } from "vitest";
import { findHolidayForDate, isHoliday, isEmergencyClosure, listHolidaysInRange } from "@/core/scheduling/holidayEngine";
import type { Holiday } from "@/types/scheduling";

function makeHoliday(overrides: Partial<Holiday> = {}): Holiday {
  return {
    id: "holiday_1",
    workspace_id: "ws_1",
    name: "New Year's Day",
    scope: "workspace",
    date: "2026-01-01",
    recurring: true,
    emergency: false,
    time_zone: "America/Sao_Paulo",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("findHolidayForDate", () => {
  it("matches a recurring holiday by month/day across years", () => {
    const holidays = [makeHoliday()];
    expect(findHolidayForDate(holidays, "ws_1", "2027-01-01")?.id).toBe("holiday_1");
  });

  it("does not match a recurring holiday on a different month/day", () => {
    const holidays = [makeHoliday()];
    expect(findHolidayForDate(holidays, "ws_1", "2027-01-02")).toBeNull();
  });

  it("matches a non-recurring holiday only on its exact date", () => {
    const holidays = [makeHoliday({ recurring: false, date: "2026-11-26" })];
    expect(findHolidayForDate(holidays, "ws_1", "2026-11-26")?.id).toBe("holiday_1");
    expect(findHolidayForDate(holidays, "ws_1", "2027-11-26")).toBeNull();
  });

  it("ignores holidays belonging to a different workspace", () => {
    const holidays = [makeHoliday({ workspace_id: "ws_2" })];
    expect(findHolidayForDate(holidays, "ws_1", "2026-01-01")).toBeNull();
  });
});

describe("isHoliday", () => {
  it("returns true when a holiday matches", () => {
    expect(isHoliday([makeHoliday()], "ws_1", "2026-01-01")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(isHoliday([makeHoliday()], "ws_1", "2026-06-15")).toBe(false);
  });
});

describe("isEmergencyClosure", () => {
  it("returns true only for a matching holiday flagged emergency", () => {
    const holidays = [makeHoliday({ id: "storm", date: "2026-06-15", recurring: false, emergency: true })];
    expect(isEmergencyClosure(holidays, "ws_1", "2026-06-15")).toBe(true);
  });

  it("returns false for a routine, non-emergency holiday", () => {
    expect(isEmergencyClosure([makeHoliday()], "ws_1", "2026-01-01")).toBe(false);
  });

  it("returns false when no holiday matches at all", () => {
    expect(isEmergencyClosure([makeHoliday()], "ws_1", "2026-06-15")).toBe(false);
  });
});

describe("listHolidaysInRange", () => {
  it("includes a non-recurring holiday whose exact date falls in range", () => {
    const holidays = [makeHoliday({ recurring: false, date: "2026-06-15" })];
    expect(listHolidaysInRange(holidays, "ws_1", "2026-06-01", "2026-06-30")).toHaveLength(1);
  });

  it("excludes a non-recurring holiday outside the range", () => {
    const holidays = [makeHoliday({ recurring: false, date: "2026-07-15" })];
    expect(listHolidaysInRange(holidays, "ws_1", "2026-06-01", "2026-06-30")).toHaveLength(0);
  });

  it("expands a recurring holiday into one occurrence per year the range spans, using each matched year rather than the original stored date", () => {
    const holidays = [makeHoliday({ date: "2026-01-01" })];
    const result = listHolidaysInRange(holidays, "ws_1", "2026-12-15", "2028-01-15");
    expect(result.map((o) => o.date)).toEqual(["2027-01-01", "2028-01-01"]);
    expect(result.every((o) => o.holiday.id === "holiday_1")).toBe(true);
  });

  it("sorts results chronologically and excludes other workspaces", () => {
    const holidays = [makeHoliday({ id: "b", recurring: false, date: "2026-06-20" }), makeHoliday({ id: "a", recurring: false, date: "2026-06-05" }), makeHoliday({ id: "other_ws", recurring: false, date: "2026-06-10", workspace_id: "ws_2" })];
    const result = listHolidaysInRange(holidays, "ws_1", "2026-06-01", "2026-06-30");
    expect(result.map((o) => o.holiday.id)).toEqual(["a", "b"]);
  });
});
