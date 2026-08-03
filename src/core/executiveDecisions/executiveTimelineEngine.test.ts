import { describe, expect, it } from "vitest";
import { decisionPriorityTimelineEvent, decisionStatusTimelineEvent } from "@/core/executiveDecisions/executiveTimelineEngine";

describe("decisionStatusTimelineEvent", () => {
  it("emits decision_created when previousStatus is null", () => {
    expect(decisionStatusTimelineEvent(null, "open", "Resolve missing contract")).toEqual({ type: "decision_created", description: 'Decision "Resolve missing contract" created.' });
  });

  it("emits decision_resolved when moving to resolved", () => {
    expect(decisionStatusTimelineEvent("in_progress", "resolved", "Resolve missing contract").type).toBe("decision_resolved");
  });

  it("emits decision_escalated when moving to escalated", () => {
    expect(decisionStatusTimelineEvent("open", "escalated", "Resolve missing contract").type).toBe("decision_escalated");
  });

  it("emits decision_archived when moving to archived", () => {
    expect(decisionStatusTimelineEvent("resolved", "archived", "Resolve missing contract").type).toBe("decision_archived");
  });

  it("emits decision_reopened when moving from resolved/escalated/archived back to an open state", () => {
    expect(decisionStatusTimelineEvent("resolved", "in_progress", "Resolve missing contract").type).toBe("decision_reopened");
    expect(decisionStatusTimelineEvent("escalated", "open", "Resolve missing contract").type).toBe("decision_reopened");
    expect(decisionStatusTimelineEvent("archived", "open", "Resolve missing contract").type).toBe("decision_reopened");
  });

  it("emits decision_updated when the status doesn't actually change", () => {
    expect(decisionStatusTimelineEvent("in_progress", "in_progress", "Resolve missing contract").type).toBe("decision_updated");
  });
});

describe("decisionPriorityTimelineEvent", () => {
  it("returns null when the priority is unchanged", () => {
    expect(decisionPriorityTimelineEvent("high", "high", "Resolve missing contract")).toBeNull();
  });

  it("emits decision_priority_changed with both values in the description", () => {
    const event = decisionPriorityTimelineEvent("medium", "critical", "Resolve missing contract");
    expect(event?.type).toBe("decision_priority_changed");
    expect(event?.description).toContain("medium");
    expect(event?.description).toContain("critical");
  });
});
