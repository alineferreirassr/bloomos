import { describe, expect, it } from "vitest";
import { computeWindowQualityScore, computeBufferQualityScore, computeCapacityUtilizationScore, computeConflictSeverityScore, computeScheduleDensityScore, computeCalendarHealthScore, computeSchedulingScores } from "@/core/scheduling/schedulingScoreEngine";

describe("computeWindowQualityScore", () => {
  it("is a vacuous 100 with no appointments", () => {
    expect(computeWindowQualityScore(0, 0)).toBe(100);
  });

  it("is 100 when no window issues", () => {
    expect(computeWindowQualityScore(10, 0)).toBe(100);
  });

  it("scales down proportionally to window issues", () => {
    expect(computeWindowQualityScore(10, 3)).toBe(70);
  });
});

describe("computeBufferQualityScore", () => {
  it("is a vacuous 100 with no appointments", () => {
    expect(computeBufferQualityScore(0, 0)).toBe(100);
  });

  it("scales down proportionally to buffer conflicts", () => {
    expect(computeBufferQualityScore(4, 1)).toBe(75);
  });
});

describe("computeCapacityUtilizationScore", () => {
  it("is a vacuous 100 with no capacity rules to check", () => {
    expect(computeCapacityUtilizationScore([])).toBe(100);
  });

  it("is 100 when every check stays within capacity", () => {
    expect(computeCapacityUtilizationScore([{ withinCapacity: true }, { withinCapacity: true }])).toBe(100);
  });

  it("scales down proportionally to breached checks", () => {
    expect(computeCapacityUtilizationScore([{ withinCapacity: true }, { withinCapacity: false }])).toBe(50);
  });
});

describe("computeConflictSeverityScore", () => {
  it("is 100 with no conflicts", () => {
    expect(computeConflictSeverityScore([])).toBe(100);
  });

  it("penalizes a high-severity conflict by 15", () => {
    expect(computeConflictSeverityScore([{ severity: "high" }])).toBe(85);
  });

  it("penalizes a medium-severity conflict by 5", () => {
    expect(computeConflictSeverityScore([{ severity: "medium" }])).toBe(95);
  });

  it("clamps at 0 rather than going negative", () => {
    const conflicts = Array.from({ length: 10 }, () => ({ severity: "high" as const }));
    expect(computeConflictSeverityScore(conflicts)).toBe(0);
  });
});

describe("computeScheduleDensityScore", () => {
  it("is 0 with no available time to book against", () => {
    expect(computeScheduleDensityScore(60, 0)).toBe(0);
  });

  it("computes the booked/available ratio as a percentage", () => {
    expect(computeScheduleDensityScore(240, 480)).toBe(50);
  });

  it("clamps at 100 when overbooked beyond available time", () => {
    expect(computeScheduleDensityScore(600, 480)).toBe(100);
  });
});

describe("computeCalendarHealthScore", () => {
  it("averages the five component scores", () => {
    const result = computeCalendarHealthScore({ windowQualityScore: 100, bufferQualityScore: 100, capacityUtilizationScore: 100, conflictSeverityScore: 100, scheduleDensityScore: 50 });
    expect(result).toBe(90);
  });
});

describe("computeSchedulingScores", () => {
  it("returns a perfect scorecard for a clean, empty calendar", () => {
    const result = computeSchedulingScores({ appointmentCount: 0, windowIssueCount: 0, bufferConflictCount: 0, capacityChecks: [], conflicts: [], bookedMinutes: 0, availableMinutes: 0 });
    expect(result).toEqual({ windowQualityScore: 100, bufferQualityScore: 100, capacityUtilizationScore: 100, conflictSeverityScore: 100, scheduleDensityScore: 0, calendarHealthScore: 80 });
  });

  it("degrades every affected score for a busy, conflict-heavy calendar", () => {
    const result = computeSchedulingScores({
      appointmentCount: 10,
      windowIssueCount: 2,
      bufferConflictCount: 1,
      capacityChecks: [{ withinCapacity: false }],
      conflicts: [{ severity: "high" }, { severity: "medium" }],
      bookedMinutes: 300,
      availableMinutes: 480,
    });
    expect(result.windowQualityScore).toBe(80);
    expect(result.bufferQualityScore).toBe(90);
    expect(result.capacityUtilizationScore).toBe(0);
    expect(result.conflictSeverityScore).toBe(80);
    expect(result.scheduleDensityScore).toBeCloseTo(62.5);
    expect(result.calendarHealthScore).toBeLessThan(100);
  });
});
