import { describe, expect, it } from "vitest";
import { computeDailyBriefConfidence, computeDailyBriefMissingInformation } from "@/modules/ai/dailyBrief/confidence";
import type { DailyOperationsBriefContext } from "@/modules/ai/dailyBrief/types";

function context(unavailableCategories: string[] = []): DailyOperationsBriefContext {
  return {
    generatedAt: "2026-07-25T00:00:00.000Z",
    eventsToday: [],
    eventsThisWeek: [],
    eventsAtRisk: [],
    latePayments: [],
    unsignedContracts: [],
    checklistProgress: { totalOpen: 0, totalOverdue: 0, totalCompleted: 0 },
    teamAssignments: [],
    unreadNotificationCount: 0,
    highPriorityClients: [],
    calendarSummary: { eventsToday: 0, eventsThisWeek: 0, eventsThisMonth: 0 },
    recentActivity: [],
    upcomingDeadlines: [],
    unavailableCategories,
  };
}

describe("computeDailyBriefConfidence", () => {
  it("is 100 when every category was read successfully, even if every list is genuinely empty", () => {
    expect(computeDailyBriefConfidence(context()).score).toBe(100);
  });

  it("deducts an equal share per unavailable category", () => {
    const result = computeDailyBriefConfidence(context(["finance"]));
    expect(result.score).toBeLessThan(100);
    expect(result.reason).toContain("Late payments");
  });

  it("reaches 0 when every category is unavailable", () => {
    const result = computeDailyBriefConfidence(context(["events", "finance", "contracts", "clients", "notifications", "activity"]));
    expect(result.score).toBe(0);
  });
});

describe("computeDailyBriefMissingInformation", () => {
  it("is empty when nothing is unavailable, regardless of how empty the lists are", () => {
    expect(computeDailyBriefMissingInformation(context())).toEqual([]);
  });

  it("names exactly the unavailable categories, never a genuinely-empty one", () => {
    const result = computeDailyBriefMissingInformation(context(["contracts"]));
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("Unsigned contracts");
  });
});
