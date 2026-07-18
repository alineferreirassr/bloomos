import { describe, expect, it } from "vitest";
import { getDueState } from "@/core/workflows/dueState";

const NOON_UTC_ON = (isoDate: string) => new Date(`${isoDate}T12:00:00.000Z`).getTime();

describe("getDueState", () => {
  it("returns null when there is no due date", () => {
    expect(getDueState(null, NOON_UTC_ON("2026-06-15"))).toBeNull();
  });

  it("returns 'overdue' for a due date before today", () => {
    expect(getDueState("2026-06-14T00:00:00.000Z", NOON_UTC_ON("2026-06-15"))).toBe("overdue");
  });

  it("returns 'overdue' for a due date several days in the past", () => {
    expect(getDueState("2026-06-01T00:00:00.000Z", NOON_UTC_ON("2026-06-15"))).toBe("overdue");
  });

  it("returns 'due_today' for a due date matching today's UTC date, regardless of time of day", () => {
    expect(getDueState("2026-06-15T23:59:00.000Z", NOON_UTC_ON("2026-06-15"))).toBe("due_today");
    expect(getDueState("2026-06-15T00:00:00.000Z", NOON_UTC_ON("2026-06-15"))).toBe("due_today");
  });

  it("returns 'due_tomorrow' for a due date exactly one day ahead", () => {
    expect(getDueState("2026-06-16T00:00:00.000Z", NOON_UTC_ON("2026-06-15"))).toBe("due_tomorrow");
  });

  it("returns null for a due date more than a day in the future", () => {
    expect(getDueState("2026-06-20T00:00:00.000Z", NOON_UTC_ON("2026-06-15"))).toBeNull();
  });
});
