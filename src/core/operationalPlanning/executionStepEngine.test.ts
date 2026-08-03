import { describe, expect, it } from "vitest";
import { flattenSteps, findStepById, findBrokenDependencies, detectDependencyCycle } from "@/core/operationalPlanning/executionStepEngine";
import type { ExecutionPhase, ExecutionStep, StepDependency } from "@/types/operationalPlanning";

function makeStep(id: string, dependencies: StepDependency[] = []): ExecutionStep {
  return { id, title: id, description: null, instructions: null, estimated_duration_minutes: 30, dependencies, assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null };
}

function makeDep(stepId: string): StepDependency {
  return { step_id: stepId, type: "finish_to_start", dependency_class: "blocking" };
}

function makePhase(id: string, steps: ExecutionStep[]): ExecutionPhase {
  return { id, kind: "execution", name: id, order: 0, steps };
}

describe("flattenSteps / findStepById", () => {
  it("flattens steps across phases and finds one by id", () => {
    const phases = [makePhase("phase_1", [makeStep("s1")]), makePhase("phase_2", [makeStep("s2")])];
    expect(flattenSteps(phases).map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(findStepById(phases, "s2")?.id).toBe("s2");
    expect(findStepById(phases, "missing")).toBeNull();
  });
});

describe("findBrokenDependencies", () => {
  it("flags a dependency pointing at a step that doesn't exist in the plan", () => {
    const phases = [makePhase("phase_1", [makeStep("s1", [makeDep("s_missing")])])];
    const broken = findBrokenDependencies(phases);
    expect(broken).toEqual([{ stepId: "s1", missingStepId: "s_missing" }]);
  });

  it("finds nothing for a plan with only real dependencies", () => {
    const phases = [makePhase("phase_1", [makeStep("s1"), makeStep("s2", [makeDep("s1")])])];
    expect(findBrokenDependencies(phases)).toHaveLength(0);
  });
});

describe("detectDependencyCycle", () => {
  it("finds no cycle in a linear dependency chain", () => {
    const phases = [makePhase("phase_1", [makeStep("s1"), makeStep("s2", [makeDep("s1")]), makeStep("s3", [makeDep("s2")])])];
    expect(detectDependencyCycle(phases).hasCycle).toBe(false);
  });

  it("detects a direct two-step cycle (s1 -> s2 -> s1)", () => {
    const phases = [makePhase("phase_1", [makeStep("s1", [makeDep("s2")]), makeStep("s2", [makeDep("s1")])])];
    const result = detectDependencyCycle(phases);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleStepIds).toContain("s1");
    expect(result.cycleStepIds).toContain("s2");
  });

  it("detects a longer cycle across phases (s1 -> s2 -> s3 -> s1)", () => {
    const phases = [makePhase("phase_1", [makeStep("s1", [makeDep("s3")]), makeStep("s2", [makeDep("s1")])]), makePhase("phase_2", [makeStep("s3", [makeDep("s2")])])];
    expect(detectDependencyCycle(phases).hasCycle).toBe(true);
  });

  it("ignores a dangling dependency reference — that's findBrokenDependencies's job, not a cycle", () => {
    const phases = [makePhase("phase_1", [makeStep("s1", [makeDep("s_missing")])])];
    expect(detectDependencyCycle(phases).hasCycle).toBe(false);
  });
});
