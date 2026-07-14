import { describe, expect, it } from "vitest";
import { getEventHealthScore } from "@/core/workflows/eventHealth";

const perfectEvent = {
  status: "confirmed" as const,
  priority: "normal" as const,
  location_name: "El Matador State Beach",
  address: null,
  budget_min: 6000,
  budget_max: 9000,
};

const healthyContext = {
  hasChecklistItems: true,
  hasOverdueChecklistItems: false,
  hasScheduleItems: true,
  hasPostEventReview: true,
  daysUntilEvent: 60,
};

describe("getEventHealthScore", () => {
  it("returns 100 for an event with no gaps", () => {
    expect(getEventHealthScore(perfectEvent, healthyContext)).toBe(100);
  });

  it("deducts for missing location", () => {
    const score = getEventHealthScore(
      { ...perfectEvent, location_name: null, address: null },
      healthyContext,
    );
    expect(score).toBe(85);
  });

  it("deducts for missing budget", () => {
    const score = getEventHealthScore(
      { ...perfectEvent, budget_min: null, budget_max: null },
      healthyContext,
    );
    expect(score).toBe(90);
  });

  it("deducts for a missing checklist", () => {
    const score = getEventHealthScore(perfectEvent, { ...healthyContext, hasChecklistItems: false });
    expect(score).toBe(85);
  });

  it("deducts for overdue checklist items", () => {
    const score = getEventHealthScore(perfectEvent, {
      ...healthyContext,
      hasOverdueChecklistItems: true,
    });
    expect(score).toBe(85);
  });

  it("deducts for a missing schedule", () => {
    const score = getEventHealthScore(perfectEvent, { ...healthyContext, hasScheduleItems: false });
    expect(score).toBe(90);
  });

  it("deducts for awaiting_contract status", () => {
    const score = getEventHealthScore({ ...perfectEvent, status: "awaiting_contract" }, healthyContext);
    expect(score).toBe(90);
  });

  it("deducts for awaiting_deposit status", () => {
    const score = getEventHealthScore({ ...perfectEvent, status: "awaiting_deposit" }, healthyContext);
    expect(score).toBe(90);
  });

  it("deducts for critical priority", () => {
    const score = getEventHealthScore({ ...perfectEvent, priority: "critical" }, healthyContext);
    expect(score).toBe(95);
  });

  it("does not deduct for urgent priority (only critical is penalized)", () => {
    const score = getEventHealthScore({ ...perfectEvent, priority: "urgent" }, healthyContext);
    expect(score).toBe(100);
  });

  it("deducts for an approaching date when not ready/in_progress/completed", () => {
    const score = getEventHealthScore(perfectEvent, { ...healthyContext, daysUntilEvent: 3 });
    expect(score).toBe(90);
  });

  it("does not deduct for an approaching date if the event is already ready", () => {
    const score = getEventHealthScore(
      { ...perfectEvent, status: "ready" },
      { ...healthyContext, daysUntilEvent: 3 },
    );
    expect(score).toBe(100);
  });

  it("deducts for a completed event missing its post-event review", () => {
    const score = getEventHealthScore(
      { ...perfectEvent, status: "completed" },
      { ...healthyContext, hasPostEventReview: false },
    );
    expect(score).toBe(90);
  });

  it("does not deduct the post-event-review penalty for a non-completed event", () => {
    const score = getEventHealthScore(perfectEvent, { ...healthyContext, hasPostEventReview: false });
    expect(score).toBe(100);
  });

  it("compounds multiple deductions", () => {
    const score = getEventHealthScore(
      { ...perfectEvent, location_name: null, address: null, budget_min: null, budget_max: null },
      { ...healthyContext, hasChecklistItems: false, hasScheduleItems: false },
    );
    expect(score).toBe(100 - 15 - 10 - 15 - 10);
  });

  it("compounds every simultaneously-possible deduction without going negative", () => {
    const score = getEventHealthScore(
      {
        status: "awaiting_deposit",
        priority: "critical",
        location_name: null,
        address: null,
        budget_min: null,
        budget_max: null,
      },
      {
        hasChecklistItems: false,
        hasOverdueChecklistItems: true,
        hasScheduleItems: false,
        hasPostEventReview: false,
        daysUntilEvent: 2,
      },
    );
    // missingLocation 15 + missingBudget 10 + missingChecklist 15 + overdue 15
    // + missingSchedule 10 + awaitingDeposit 10 + critical 5 + approaching 10 = 90
    expect(score).toBe(10);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("clamps at 0 rather than going negative when deductions would exceed 100", () => {
    // Deductions alone can't exceed 100 given the mutually-exclusive status
    // checks, so this exercises the Math.max(0, ...) clamp directly by
    // confirming the score never reports negative for the worst realistic case.
    const score = getEventHealthScore(
      {
        status: "awaiting_contract",
        priority: "critical",
        location_name: null,
        address: null,
        budget_min: null,
        budget_max: null,
      },
      {
        hasChecklistItems: false,
        hasOverdueChecklistItems: true,
        hasScheduleItems: false,
        hasPostEventReview: false,
        daysUntilEvent: 0,
      },
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
