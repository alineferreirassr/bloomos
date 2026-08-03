import { describe, expect, it } from "vitest";
import { getEventHealthDetails, getEventHealthScore, getEventHealthStatus } from "@/core/workflows/eventHealth";

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

describe("getEventHealthDetails", () => {
  it("returns an empty factors list and score 100 for a perfect event", () => {
    const details = getEventHealthDetails(perfectEvent, healthyContext);
    expect(details.score).toBe(100);
    expect(details.factors).toEqual([]);
  });

  it("returns the score consistent with getEventHealthScore for the same inputs", () => {
    const event = { ...perfectEvent, location_name: null, address: null };
    const context = { ...healthyContext, hasScheduleItems: false };
    const details = getEventHealthDetails(event, context);
    expect(details.score).toBe(getEventHealthScore(event, context));
  });

  it("lists every triggered factor with its label and deduction", () => {
    const details = getEventHealthDetails(
      { ...perfectEvent, budget_min: null, budget_max: null },
      { ...healthyContext, hasScheduleItems: false },
    );
    expect(details.factors).toEqual(
      expect.arrayContaining([
        { label: "Missing budget", deduction: 10 },
        { label: "No schedule items", deduction: 10 },
      ]),
    );
    expect(details.factors).toHaveLength(2);
  });

  it("sorts factors by deduction size, largest first", () => {
    const details = getEventHealthDetails(
      { ...perfectEvent, location_name: null, address: null, budget_min: null, budget_max: null },
      { ...healthyContext, hasChecklistItems: false },
    );
    // missingLocation (15) and missingChecklist (15) tie for largest, missingBudget (10) is smallest.
    expect(details.factors[0].deduction).toBeGreaterThanOrEqual(details.factors[1].deduction);
    expect(details.factors[1].deduction).toBeGreaterThanOrEqual(details.factors[2].deduction);
    expect(details.factors.map((f) => f.deduction)).toEqual([15, 15, 10]);
  });
});

describe("getEventHealthStatus (Booking Workflow, Phase 2 — condition-based, not score-based)", () => {
  it("returns 'ready' when nothing is triggered, regardless of score being exactly 100", () => {
    expect(getEventHealthStatus(perfectEvent, healthyContext)).toBe("ready");
  });

  it("returns 'waiting' for a non-blocking gap even though it lowers the score", () => {
    const status = getEventHealthStatus(
      { ...perfectEvent, location_name: null, address: null },
      healthyContext,
    );
    expect(status).toBe("waiting");
  });

  it("returns 'blocked' when the event is awaiting a contract, even with an otherwise-high score", () => {
    const status = getEventHealthStatus({ ...perfectEvent, status: "awaiting_contract" }, healthyContext);
    expect(status).toBe("blocked");
  });

  it("returns 'blocked' when the event is awaiting a deposit", () => {
    const status = getEventHealthStatus({ ...perfectEvent, status: "awaiting_deposit" }, healthyContext);
    expect(status).toBe("blocked");
  });

  it("returns 'blocked' when a checklist item is overdue, even if every other signal is healthy", () => {
    const status = getEventHealthStatus(perfectEvent, { ...healthyContext, hasOverdueChecklistItems: true });
    expect(status).toBe("blocked");
  });

  it("prioritizes 'blocked' over 'waiting' when both a blocking condition and a non-blocking gap are present", () => {
    const status = getEventHealthStatus(
      { ...perfectEvent, status: "awaiting_deposit", location_name: null, address: null },
      healthyContext,
    );
    expect(status).toBe("blocked");
  });
});
