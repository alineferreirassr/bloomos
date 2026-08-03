import { describe, expect, it } from "vitest";
import { objectiveTimelineEventForTransition } from "@/core/objectives/objectiveTimelineEngine";

describe("objectiveTimelineEventForTransition", () => {
  it("emits objective_created when previousStatus is null", () => {
    expect(objectiveTimelineEventForTransition(null, "not_started", "Ready for launch")).toEqual({ type: "objective_created", description: 'Objective "Ready for launch" created.' });
  });

  it("emits objective_started when moving from not_started to in_progress", () => {
    expect(objectiveTimelineEventForTransition("not_started", "in_progress", "Ready for launch").type).toBe("objective_started");
  });

  it("emits objective_completed when moving to completed", () => {
    expect(objectiveTimelineEventForTransition("in_progress", "completed", "Ready for launch").type).toBe("objective_completed");
  });

  it("emits objective_blocked when moving to blocked", () => {
    expect(objectiveTimelineEventForTransition("in_progress", "blocked", "Ready for launch").type).toBe("objective_blocked");
  });

  it("emits objective_archived when moving to archived", () => {
    expect(objectiveTimelineEventForTransition("completed", "archived", "Ready for launch").type).toBe("objective_archived");
  });

  it("emits objective_reopened when moving from blocked or completed back to an open state", () => {
    expect(objectiveTimelineEventForTransition("blocked", "in_progress", "Ready for launch").type).toBe("objective_reopened");
    expect(objectiveTimelineEventForTransition("completed", "in_progress", "Ready for launch").type).toBe("objective_reopened");
    expect(objectiveTimelineEventForTransition("archived", "not_started", "Ready for launch").type).toBe("objective_reopened");
  });

  it("emits objective_updated when the status doesn't actually change", () => {
    expect(objectiveTimelineEventForTransition("in_progress", "in_progress", "Ready for launch").type).toBe("objective_updated");
  });
});
