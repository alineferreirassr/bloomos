import { describe, expect, it } from "vitest";
import { computeCriticalPath } from "@/core/operationalPlanning/criticalPathEngine";
import type { ExecutionPhase, ExecutionStep, StepDependency } from "@/types/operationalPlanning";

function makeStep(id: string, durationMinutes: number, dependencies: StepDependency[] = []): ExecutionStep {
  return { id, title: id, description: null, instructions: null, estimated_duration_minutes: durationMinutes, dependencies, assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null };
}

function dep(stepId: string, dependency_class: StepDependency["dependency_class"] = "blocking"): StepDependency {
  return { step_id: stepId, type: "finish_to_start", dependency_class };
}

function makePhase(id: string, steps: ExecutionStep[]): ExecutionPhase {
  return { id, kind: "execution", name: id, order: 0, steps };
}

describe("computeCriticalPath", () => {
  it("computes the longest chain's total duration for a linear plan", () => {
    const phases = [makePhase("p1", [makeStep("s1", 30), makeStep("s2", 20, [dep("s1")]), makeStep("s3", 10, [dep("s2")])])];
    const result = computeCriticalPath(phases);
    expect(result.estimatedCompletionMinutes).toBe(60);
    expect(result.criticalStepIds.sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("picks the longer of two parallel branches as critical, leaving the shorter one off the critical path", () => {
    // s1 (60min) and s2 (10min) both feed into s3; the critical path runs through s1.
    const phases = [makePhase("p1", [makeStep("s1", 60), makeStep("s2", 10), makeStep("s3", 5, [dep("s1"), dep("s2")])])];
    const result = computeCriticalPath(phases);
    expect(result.estimatedCompletionMinutes).toBe(65);
    expect(result.criticalStepIds).toContain("s1");
    expect(result.criticalStepIds).toContain("s3");
    expect(result.criticalStepIds).not.toContain("s2");
    expect(result.parallelStepIds).toContain("s2");
  });

  it("classifies a step as blocking when another step depends on it with dependency_class 'blocking'", () => {
    const phases = [makePhase("p1", [makeStep("s1", 10), makeStep("s2", 10, [dep("s1", "blocking")])])];
    const result = computeCriticalPath(phases);
    expect(result.blockingStepIds).toEqual(["s1"]);
  });

  it("classifies a step as optional when every incoming reliance on it is dependency_class 'optional'", () => {
    const phases = [makePhase("p1", [makeStep("s1", 10), makeStep("s2", 10, [dep("s1", "optional")])])];
    const result = computeCriticalPath(phases);
    expect(result.optionalStepIds).toEqual(["s1"]);
  });

  it("never classifies a step as optional if any incoming reliance on it is blocking or critical", () => {
    const phases = [makePhase("p1", [makeStep("s1", 10), makeStep("s2", 10, [dep("s1", "optional")]), makeStep("s3", 10, [dep("s1", "critical")])])];
    const result = computeCriticalPath(phases);
    expect(result.optionalStepIds).not.toContain("s1");
  });
});
