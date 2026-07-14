import { describe, expect, it } from "vitest";
import {
  canTransitionEventStatus,
  canTransitionLifecycleStage,
  getEventNextRecommendedAction,
  getNextEventStatuses,
  getNextLifecycleStages,
  isEventTerminal,
  isLifecycleStageTerminal,
  EVENT_STATUSES,
  EVENT_LIFECYCLE_STAGES,
} from "@/core/workflows/eventWorkflow";

describe("isEventTerminal", () => {
  it("is true only for completed, cancelled, and archived", () => {
    expect(isEventTerminal("completed")).toBe(true);
    expect(isEventTerminal("cancelled")).toBe(true);
    expect(isEventTerminal("archived")).toBe(true);
    for (const status of EVENT_STATUSES) {
      if (status === "completed" || status === "cancelled" || status === "archived") continue;
      expect(isEventTerminal(status)).toBe(false);
    }
  });
});

describe("canTransitionEventStatus", () => {
  it("disallows transitioning to the same status", () => {
    expect(canTransitionEventStatus("draft", "draft")).toBe(false);
  });

  it("disallows any transition away from a terminal status", () => {
    expect(canTransitionEventStatus("completed", "draft")).toBe(false);
    expect(canTransitionEventStatus("cancelled", "planning")).toBe(false);
    expect(canTransitionEventStatus("archived", "confirmed")).toBe(false);
  });

  it("disallows transitioning directly into completed, cancelled, or archived via the plain selector", () => {
    expect(canTransitionEventStatus("draft", "completed")).toBe(false);
    expect(canTransitionEventStatus("confirmed", "cancelled")).toBe(false);
    expect(canTransitionEventStatus("planning", "archived")).toBe(false);
  });

  it("allows moving between two working statuses, forward or backward", () => {
    expect(canTransitionEventStatus("draft", "inquiry")).toBe(true);
    expect(canTransitionEventStatus("ready", "planning")).toBe(true);
  });
});

describe("getNextEventStatuses", () => {
  it("returns an empty list for terminal statuses", () => {
    expect(getNextEventStatuses("completed")).toEqual([]);
    expect(getNextEventStatuses("cancelled")).toEqual([]);
    expect(getNextEventStatuses("archived")).toEqual([]);
  });

  it("never includes the current status or a locked status", () => {
    const next = getNextEventStatuses("planning");
    expect(next).not.toContain("planning");
    expect(next).not.toContain("completed");
    expect(next).not.toContain("cancelled");
    expect(next).not.toContain("archived");
  });
});

describe("isLifecycleStageTerminal", () => {
  it("is true only for closed", () => {
    expect(isLifecycleStageTerminal("closed")).toBe(true);
    for (const stage of EVENT_LIFECYCLE_STAGES) {
      if (stage === "closed") continue;
      expect(isLifecycleStageTerminal(stage)).toBe(false);
    }
  });
});

describe("canTransitionLifecycleStage", () => {
  it("disallows transitioning to the same stage", () => {
    expect(canTransitionLifecycleStage("intake", "intake")).toBe(false);
  });

  it("disallows any transition away from closed", () => {
    expect(canTransitionLifecycleStage("closed", "intake")).toBe(false);
  });

  it("allows transitioning into closed via the plain selector — there's no separate dedicated close action", () => {
    expect(canTransitionLifecycleStage("post_event", "closed")).toBe(true);
  });

  it("allows moving between two working stages, forward or backward", () => {
    expect(canTransitionLifecycleStage("intake", "planning")).toBe(true);
    expect(canTransitionLifecycleStage("execution", "preparation")).toBe(true);
  });

  it("supports the new operational stages (setup, live_event, breakdown) in the recommended order", () => {
    expect(EVENT_LIFECYCLE_STAGES).toEqual([
      "intake",
      "proposal",
      "booking",
      "planning",
      "preparation",
      "setup",
      "execution",
      "live_event",
      "breakdown",
      "post_event",
      "closed",
    ]);
    expect(canTransitionLifecycleStage("preparation", "setup")).toBe(true);
    expect(canTransitionLifecycleStage("execution", "live_event")).toBe(true);
    expect(canTransitionLifecycleStage("live_event", "breakdown")).toBe(true);
    expect(canTransitionLifecycleStage("breakdown", "post_event")).toBe(true);
  });
});

describe("getNextLifecycleStages", () => {
  it("returns an empty list once closed", () => {
    expect(getNextLifecycleStages("closed")).toEqual([]);
  });

  it("never includes the current stage but does include closed", () => {
    const next = getNextLifecycleStages("planning");
    expect(next).not.toContain("planning");
    expect(next).toContain("closed");
  });
});

describe("getEventNextRecommendedAction", () => {
  const baseEvent = {
    status: "confirmed" as const,
    event_date: "2026-12-01",
    location_name: "El Matador State Beach",
    address: null,
    budget_min: 6000,
    budget_max: 9000,
  };
  const baseContext = {
    hasChecklistItems: true,
    hasOverdueChecklistItems: false,
    hasScheduleItems: true,
    hasPostEventReview: true,
    daysUntilEvent: 60,
  };

  it("returns null for archived or cancelled events regardless of anything else missing", () => {
    expect(
      getEventNextRecommendedAction(
        { ...baseEvent, status: "archived", event_date: null },
        { ...baseContext, hasChecklistItems: false },
      ),
    ).toBeNull();
    expect(
      getEventNextRecommendedAction({ ...baseEvent, status: "cancelled" }, baseContext),
    ).toBeNull();
  });

  it("recommends completing details for a draft event", () => {
    const action = getEventNextRecommendedAction({ ...baseEvent, status: "draft" }, baseContext);
    expect(action).toMatch(/draft/i);
  });

  it("recommends setting the event date when missing", () => {
    const action = getEventNextRecommendedAction({ ...baseEvent, event_date: null }, baseContext);
    expect(action).toMatch(/event date/i);
  });

  it("recommends adding a location when both location_name and address are missing", () => {
    const action = getEventNextRecommendedAction(
      { ...baseEvent, location_name: null, address: null },
      baseContext,
    );
    expect(action).toMatch(/location/i);
  });

  it("recommends setting a budget when both budget_min and budget_max are missing", () => {
    const action = getEventNextRecommendedAction(
      { ...baseEvent, budget_min: null, budget_max: null },
      baseContext,
    );
    expect(action).toMatch(/budget/i);
  });

  it("recommends sending the contract when awaiting_contract", () => {
    const action = getEventNextRecommendedAction(
      { ...baseEvent, status: "awaiting_contract" },
      baseContext,
    );
    expect(action).toMatch(/contract/i);
  });

  it("recommends collecting the deposit when awaiting_deposit", () => {
    const action = getEventNextRecommendedAction(
      { ...baseEvent, status: "awaiting_deposit" },
      baseContext,
    );
    expect(action).toMatch(/deposit/i);
  });

  it("recommends creating a checklist when there are no checklist items", () => {
    const action = getEventNextRecommendedAction(baseEvent, {
      ...baseContext,
      hasChecklistItems: false,
    });
    expect(action).toMatch(/checklist/i);
  });

  it("recommends resolving overdue checklist items over building the schedule", () => {
    const action = getEventNextRecommendedAction(baseEvent, {
      ...baseContext,
      hasOverdueChecklistItems: true,
      hasScheduleItems: false,
    });
    expect(action).toMatch(/overdue/i);
  });

  it("recommends building the schedule when there are none", () => {
    const action = getEventNextRecommendedAction(baseEvent, {
      ...baseContext,
      hasScheduleItems: false,
    });
    expect(action).toMatch(/schedule/i);
  });

  it("recommends confirming readiness when the event is approaching and not yet ready", () => {
    const action = getEventNextRecommendedAction(baseEvent, {
      ...baseContext,
      daysUntilEvent: 3,
    });
    expect(action).toMatch(/approaching/i);
  });

  it("does not flag an approaching event that is already ready or in progress", () => {
    expect(
      getEventNextRecommendedAction(
        { ...baseEvent, status: "ready" },
        { ...baseContext, daysUntilEvent: 3 },
      ),
    ).toBeNull();
    expect(
      getEventNextRecommendedAction(
        { ...baseEvent, status: "in_progress" },
        { ...baseContext, daysUntilEvent: 3 },
      ),
    ).toBeNull();
  });

  it("recommends completing the post-event review for a completed event missing one", () => {
    const action = getEventNextRecommendedAction(
      { ...baseEvent, status: "completed" },
      { ...baseContext, hasPostEventReview: false },
    );
    expect(action).toMatch(/post-event review/i);
  });

  it("returns null once everything is in order", () => {
    const action = getEventNextRecommendedAction(baseEvent, baseContext);
    expect(action).toBeNull();
  });
});
