import { describe, expect, it } from "vitest";
import { computeExecutionComplexity, resolveRiskLevel, compareOperationalPlans, type ComparisonPlanInput } from "@/core/operationalPlanning/operationalComparisonEngine";
import type { ExecutionPhase, ExecutionStep, OperationalHealthScores, CriticalPathResult } from "@/types/operationalPlanning";

const PERFECT_HEALTH: OperationalHealthScores = { planCompletenessScore: 100, dependencyHealthScore: 100, evidenceCoverageScore: 100, checklistCoverageScore: 100, approvalCoverageScore: 100, deliverableCoverageScore: 100, milestoneCoverageScore: 100, overallOperationalHealth: 95 };
const MEDIOCRE_HEALTH: OperationalHealthScores = { ...PERFECT_HEALTH, overallOperationalHealth: 60 };
const EMPTY_CRITICAL_PATH: CriticalPathResult = { criticalStepIds: [], blockingStepIds: [], parallelStepIds: [], optionalStepIds: [], estimatedCompletionMinutes: 0 };

function makeStep(id: string): ExecutionStep {
  return { id, title: id, description: null, instructions: null, estimated_duration_minutes: 10, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null };
}

function makePhase(id: string, steps: ExecutionStep[]): ExecutionPhase {
  return { id, kind: "execution", name: id, order: 0, steps };
}

function basePlanInput(overrides: Partial<ComparisonPlanInput> = {}): ComparisonPlanInput {
  return { planId: "plan_1", planName: "Plan 1", phases: [], deliverables: [], evidenceRequirements: [], milestones: [], health: PERFECT_HEALTH, criticalPath: EMPTY_CRITICAL_PATH, validationErrorCount: 0, ...overrides };
}

describe("computeExecutionComplexity", () => {
  it("sums step count and total dependency-edge count", () => {
    const phases = [makePhase("p1", [makeStep("s1"), { ...makeStep("s2"), dependencies: [{ step_id: "s1", type: "finish_to_start", dependency_class: "blocking" }] }])];
    expect(computeExecutionComplexity(phases)).toBe(3);
  });
});

describe("resolveRiskLevel", () => {
  it("is high whenever a blocking validation error exists, regardless of health", () => {
    expect(resolveRiskLevel(PERFECT_HEALTH, 1)).toBe("high");
  });

  it("maps health thresholds to low/medium/high with zero errors", () => {
    expect(resolveRiskLevel(PERFECT_HEALTH, 0)).toBe("low");
    expect(resolveRiskLevel(MEDIOCRE_HEALTH, 0)).toBe("medium");
    expect(resolveRiskLevel({ ...PERFECT_HEALTH, overallOperationalHealth: 10 }, 0)).toBe("high");
  });
});

describe("compareOperationalPlans", () => {
  it("returns one entry per plan and no differences for a single plan", () => {
    const result = compareOperationalPlans([basePlanInput()]);
    expect(result.entries).toHaveLength(1);
    expect(result.differences).toHaveLength(0);
  });

  it("calls out the healthiest plan and any high-risk plans across multiple", () => {
    const result = compareOperationalPlans([basePlanInput({ planId: "p1", planName: "Plan A", health: PERFECT_HEALTH }), basePlanInput({ planId: "p2", planName: "Plan B", health: MEDIOCRE_HEALTH, validationErrorCount: 1 })]);
    expect(result.differences.some((d) => d.includes("Plan A"))).toBe(true);
    expect(result.differences.some((d) => d.includes("high risk"))).toBe(true);
    expect(result.entries.find((e) => e.planId === "p2")?.riskLevel).toBe("high");
  });
});
