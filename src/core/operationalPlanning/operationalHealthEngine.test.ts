import { describe, expect, it } from "vitest";
import { computePlanCompletenessScore, computeDependencyHealthScore, computeEvidenceCoverageScore, computeChecklistCoverageScore, computeApprovalCoverageScore, computeDeliverableCoverageScore, computeMilestoneCoverageScore, computeOperationalHealthScores, type OperationalHealthInput } from "@/core/operationalPlanning/operationalHealthEngine";
import type { ExecutionPhase, ExecutionStep, Milestone, Deliverable, PlanChecklist, ApprovalRequirement } from "@/types/operationalPlanning";

function makeStep(id: string, overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return { id, title: id, description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: "req_1", priority: "medium", status: "pending", notes: null, ...overrides };
}

function makePhase(id: string, steps: ExecutionStep[]): ExecutionPhase {
  return { id, kind: "execution", name: id, order: 0, steps };
}

function baseInput(overrides: Partial<OperationalHealthInput> = {}): OperationalHealthInput {
  return { phases: [], milestones: [], deliverables: [], evidenceRequirements: [], checklists: [], approvals: [], ...overrides };
}

describe("computePlanCompletenessScore", () => {
  it("is vacuous 100 for zero steps", () => {
    expect(computePlanCompletenessScore(baseInput())).toBe(100);
  });

  it("is the ratio of fully-specified steps", () => {
    const phases = [makePhase("p1", [makeStep("s1"), makeStep("s2", { assigned_resource_type: null })])];
    expect(computePlanCompletenessScore(baseInput({ phases }))).toBe(50);
  });
});

describe("computeDependencyHealthScore", () => {
  it("is 0 (not vacuous) when a real cycle exists", () => {
    const phases = [makePhase("p1", [makeStep("s1", { dependencies: [{ step_id: "s2", type: "finish_to_start", dependency_class: "blocking" }] }), makeStep("s2", { dependencies: [{ step_id: "s1", type: "finish_to_start", dependency_class: "blocking" }] })])];
    expect(computeDependencyHealthScore(baseInput({ phases }))).toBe(0);
  });

  it("is vacuous 100 with zero dependencies declared", () => {
    const phases = [makePhase("p1", [makeStep("s1")])];
    expect(computeDependencyHealthScore(baseInput({ phases }))).toBe(100);
  });
});

describe("computeEvidenceCoverageScore", () => {
  it("is vacuous 100 for zero milestones", () => {
    expect(computeEvidenceCoverageScore(baseInput())).toBe(100);
  });

  it("is the ratio of milestones with at least one declared evidence requirement", () => {
    const milestones: Milestone[] = [
      { id: "m1", title: "M1", target_phase_id: null, completion_criteria: "Done", evidence_requirement_ids: ["e1"], approval_required: false, status: "not_started" },
      { id: "m2", title: "M2", target_phase_id: null, completion_criteria: "Done", evidence_requirement_ids: [], approval_required: false, status: "not_started" },
    ];
    expect(computeEvidenceCoverageScore(baseInput({ milestones }))).toBe(50);
  });
});

describe("computeChecklistCoverageScore / computeApprovalCoverageScore / computeDeliverableCoverageScore / computeMilestoneCoverageScore", () => {
  it("are all vacuous 100 when their respective arrays are empty", () => {
    expect(computeChecklistCoverageScore(baseInput())).toBe(100);
    expect(computeApprovalCoverageScore(baseInput())).toBe(100);
    expect(computeDeliverableCoverageScore(baseInput())).toBe(100);
    expect(computeMilestoneCoverageScore(baseInput())).toBe(100);
  });

  it("compute real ratios when populated", () => {
    const checklists: PlanChecklist[] = [{ id: "c1", template_id: null, name: "C1", kind: "task", items: [{ id: "i1", label: "A", completed: true }, { id: "i2", label: "B", completed: false }] }];
    const approvals: ApprovalRequirement[] = [{ id: "a1", type: "manager", description: "Sign-off", phase_id: null, step_id: null, milestone_id: null, status: "approved", approved_by: "m1", approved_at: "2026-01-01T00:00:00.000Z" }];
    const deliverables: Deliverable[] = [{ id: "d1", title: "D1", type: "document", description: null, produced_by_step_id: null, status: "delivered", linked_node: null }, { id: "d2", title: "D2", type: "document", description: null, produced_by_step_id: null, status: "pending", linked_node: null }];
    expect(computeChecklistCoverageScore(baseInput({ checklists }))).toBe(50);
    expect(computeApprovalCoverageScore(baseInput({ approvals }))).toBe(100);
    expect(computeDeliverableCoverageScore(baseInput({ deliverables }))).toBe(50);
  });
});

describe("computeOperationalHealthScores", () => {
  it("returns 100 across the board for a fully empty, trivially valid plan", () => {
    const scores = computeOperationalHealthScores(baseInput());
    expect(scores.overallOperationalHealth).toBe(100);
  });
});
