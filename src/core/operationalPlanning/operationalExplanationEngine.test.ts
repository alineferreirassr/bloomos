import { describe, expect, it } from "vitest";
import { explainOperationalPlan } from "@/core/operationalPlanning/operationalExplanationEngine";
import type { OperationalValidationResult, OperationalHealthScores, CriticalPathResult, Milestone, Deliverable } from "@/types/operationalPlanning";

const PERFECT_HEALTH: OperationalHealthScores = { planCompletenessScore: 100, dependencyHealthScore: 100, evidenceCoverageScore: 100, checklistCoverageScore: 100, approvalCoverageScore: 100, deliverableCoverageScore: 100, milestoneCoverageScore: 100, overallOperationalHealth: 100 };
const EMPTY_CRITICAL_PATH: CriticalPathResult = { criticalStepIds: [], blockingStepIds: [], parallelStepIds: [], optionalStepIds: [], estimatedCompletionMinutes: 0 };

describe("explainOperationalPlan", () => {
  it("summarizes a clean plan with no issues", () => {
    const validation: OperationalValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainOperationalPlan(validation, PERFECT_HEALTH, EMPTY_CRITICAL_PATH, [], []);
    expect(explanation.summary).toBe("Overall operational health 100/100.");
    expect(explanation.missingRequirements).toHaveLength(0);
  });

  it("separates dependency failures from other missing requirements", () => {
    const validation: OperationalValidationResult = { valid: false, errors: [{ rule: "broken_dependencies", detail: "A circular dependency exists." }, { rule: "missing_evidence", detail: "Evidence requirement is unattached." }], warnings: [{ rule: "required_approvals", detail: "1 approval requirement(s) are still pending." }] };
    const explanation = explainOperationalPlan(validation, PERFECT_HEALTH, EMPTY_CRITICAL_PATH, [], []);
    expect(explanation.dependencyFailures).toEqual(["A circular dependency exists."]);
    expect(explanation.missingRequirements).toEqual(["Evidence requirement is unattached."]);
    expect(explanation.evidenceGaps).toEqual(["Evidence requirement is unattached."]);
    expect(explanation.approvalBlockers).toEqual(["1 approval requirement(s) are still pending."]);
    expect(explanation.summary).toContain("2 blocking issues");
  });

  it("lists incomplete milestones and deliverables by name", () => {
    const milestones: Milestone[] = [{ id: "m1", title: "Setup Complete", target_phase_id: null, completion_criteria: "Done", evidence_requirement_ids: [], approval_required: false, status: "in_progress" }];
    const deliverables: Deliverable[] = [{ id: "d1", title: "Final Photos", type: "digital", description: null, produced_by_step_id: null, status: "pending", linked_node: null }];
    const validation: OperationalValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainOperationalPlan(validation, PERFECT_HEALTH, EMPTY_CRITICAL_PATH, milestones, deliverables);
    expect(explanation.incompleteMilestones[0]).toContain("Setup Complete");
    expect(explanation.incompleteDeliverables[0]).toContain("Final Photos");
  });

  it("includes a critical path summary", () => {
    const criticalPath: CriticalPathResult = { criticalStepIds: ["s1", "s2"], blockingStepIds: [], parallelStepIds: [], optionalStepIds: [], estimatedCompletionMinutes: 90 };
    const validation: OperationalValidationResult = { valid: true, errors: [], warnings: [] };
    const explanation = explainOperationalPlan(validation, PERFECT_HEALTH, criticalPath, [], []);
    expect(explanation.criticalPathSummary).toBe("2 step(s) on the critical path, estimated 90 minute(s) to complete.");
  });
});
