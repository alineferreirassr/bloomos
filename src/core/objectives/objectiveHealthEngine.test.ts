import { describe, expect, it } from "vitest";
import { computeObjectiveHealth } from "@/core/objectives/objectiveHealthEngine";
import type { DependencyEvaluation } from "@/core/objectives/objectiveEngine";
import type { Objective, ObjectiveDependency, ObjectiveProgress } from "@/types/objectives";

const NOW = "2026-07-30T00:00:00.000Z";

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: "objective_1",
    workspace_id: "ws_1",
    scope: "event",
    node: { nodeType: "event", nodeId: "event_1" },
    title: "Event is fully ready",
    description: null,
    status: "in_progress",
    requirements: [],
    dependencies: [],
    due_date: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeProgress(overrides: Partial<ObjectiveProgress> = {}): ObjectiveProgress {
  return { objectiveId: "objective_1", completionPercent: 100, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 100, ...overrides };
}

describe("computeObjectiveHealth", () => {
  it("is blocked when an unmet dependency exists, regardless of completion percent", () => {
    const dependency: ObjectiveDependency = { id: "d1", kind: "objective", description: "Needs the Contract objective done", targetObjectiveId: "objective_2", targetNode: null, businessRuleId: null, approvalKey: null };
    const unmet: DependencyEvaluation = { dependency, satisfied: false, detail: "Needs the Contract objective done (depends on an objective that is not yet completed.)" };

    const health = computeObjectiveHealth(makeObjective(), makeProgress({ completionPercent: 100 }), [unmet], NOW);
    expect(health.state).toBe("blocked");
    expect(health.reasons).toContain(unmet.detail);
  });

  it("is off_track when overdue", () => {
    const health = computeObjectiveHealth(makeObjective({ due_date: "2026-07-01T00:00:00.000Z" }), makeProgress({ completionPercent: 90 }), [], NOW);
    expect(health.state).toBe("off_track");
    expect(health.effectiveStatus).toBe("overdue");
    expect(health.reasons).toContain("Past its due date.");
  });

  it("classifies on_track / at_risk / off_track by completion percent when not overdue or blocked", () => {
    expect(computeObjectiveHealth(makeObjective(), makeProgress({ completionPercent: 80 }), [], NOW).state).toBe("on_track");
    expect(computeObjectiveHealth(makeObjective(), makeProgress({ completionPercent: 50 }), [], NOW).state).toBe("at_risk");
    expect(computeObjectiveHealth(makeObjective(), makeProgress({ completionPercent: 10 }), [], NOW).state).toBe("off_track");
  });

  it("is always on_track once completed or archived, even past due_date", () => {
    const completed = computeObjectiveHealth(makeObjective({ status: "completed", due_date: "2026-01-01T00:00:00.000Z" }), makeProgress(), [], NOW);
    expect(completed.state).toBe("on_track");
    expect(completed.effectiveStatus).toBe("completed");

    const archived = computeObjectiveHealth(makeObjective({ status: "archived", due_date: "2026-01-01T00:00:00.000Z" }), makeProgress(), [], NOW);
    expect(archived.state).toBe("on_track");
  });

  it("surfaces missing requirements as both reasons and OperationalRecommendations", () => {
    const health = computeObjectiveHealth(makeObjective(), makeProgress({ completionPercent: 50, missingRequirements: ["Needs a Hero Image"] }), [], NOW);
    expect(health.reasons).toContain("Needs a Hero Image");
    expect(health.recommendations).toHaveLength(1);
    expect(health.recommendations[0].node).toEqual({ nodeType: "event", nodeId: "event_1" });
  });

  it("falls back to the workspace node for a scope with no anchored node", () => {
    const objective = makeObjective({ scope: "department", node: null });
    const health = computeObjectiveHealth(objective, makeProgress({ completionPercent: 40, missingRequirements: ["Needs approval"] }), [], NOW);
    expect(health.recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });
});
