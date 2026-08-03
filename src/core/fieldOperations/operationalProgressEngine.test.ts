import { describe, expect, it } from "vitest";
import { computeOperationalProgress, type ComputeOperationalProgressInput } from "@/core/fieldOperations/operationalProgressEngine";
import type { ExecutionPhase, Milestone, Deliverable, PlanChecklist } from "@/types/operationalPlanning";

const PHASES: ExecutionPhase[] = [
  { id: "phase_1", kind: "setup", name: "Setup", order: 1, steps: [{ id: "step_1", title: "Unload van", description: null, instructions: null, estimated_duration_minutes: 15, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] },
  { id: "phase_2", kind: "execution", name: "Execution", order: 2, steps: [{ id: "step_2", title: "Install arch", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] },
];

const MILESTONES: Milestone[] = [{ id: "milestone_1", title: "Setup complete", target_phase_id: "phase_1", completion_criteria: "All setup steps done", evidence_requirement_ids: [], approval_required: false, status: "not_started" }];

const DELIVERABLES: Deliverable[] = [{ id: "deliverable_1", title: "Signed contract", type: "document", description: null, produced_by_step_id: null, status: "pending", linked_node: null }];

const CHECKLISTS: PlanChecklist[] = [{ id: "checklist_1", template_id: null, name: "Safety Checklist", kind: "safety", items: [{ id: "item_1", label: "Hard hat on", completed: false }, { id: "item_2", label: "Gloves on", completed: false }] }];

function baseInput(overrides: Partial<ComputeOperationalProgressInput["session"]> = {}): ComputeOperationalProgressInput {
  return {
    phases: PHASES,
    milestones: MILESTONES,
    deliverables: DELIVERABLES,
    checklists: CHECKLISTS,
    session: { current_phase_id: null, completed_step_ids: [], completed_milestone_ids: [], completed_checklist_item_ids: [], completed_deliverable_ids: [], ...overrides },
  };
}

describe("operationalProgressEngine", () => {
  it("reports every step remaining and 0% progress when nothing is done", () => {
    const progress = computeOperationalProgress(baseInput());
    expect(progress.completedStepIds).toEqual([]);
    expect(progress.remainingStepIds).toEqual(["step_1", "step_2"]);
    expect(progress.checklistProgress).toBe(0);
    expect(progress.deliverableProgress).toBe(0);
  });

  it("moves a step from remaining to completed once the session marks it done", () => {
    const progress = computeOperationalProgress(baseInput({ completed_step_ids: ["step_1"] }));
    expect(progress.completedStepIds).toEqual(["step_1"]);
    expect(progress.remainingStepIds).toEqual(["step_2"]);
  });

  it("derives currentPhaseId as the first phase with an incomplete step when no explicit pointer is set", () => {
    expect(computeOperationalProgress(baseInput()).currentPhaseId).toBe("phase_1");
    expect(computeOperationalProgress(baseInput({ completed_step_ids: ["step_1"] })).currentPhaseId).toBe("phase_2");
  });

  it("falls back to the last phase once every step is complete", () => {
    expect(computeOperationalProgress(baseInput({ completed_step_ids: ["step_1", "step_2"] })).currentPhaseId).toBe("phase_2");
  });

  it("prefers the session's own explicit current_phase_id when set", () => {
    const progress = computeOperationalProgress(baseInput({ current_phase_id: "phase_2" }));
    expect(progress.currentPhaseId).toBe("phase_2");
  });

  it("computes milestone progress from the session's own completion overlay", () => {
    const progress = computeOperationalProgress(baseInput({ completed_milestone_ids: ["milestone_1"] }));
    expect(progress.completedMilestoneIds).toEqual(["milestone_1"]);
    expect(progress.pendingMilestoneIds).toEqual([]);
  });

  it("computes checklistProgress across every checklist's items", () => {
    const progress = computeOperationalProgress(baseInput({ completed_checklist_item_ids: ["item_1"] }));
    expect(progress.checklistProgress).toBe(50);
  });

  it("computes deliverableProgress from the session's own completion overlay", () => {
    const progress = computeOperationalProgress(baseInput({ completed_deliverable_ids: ["deliverable_1"] }));
    expect(progress.deliverableProgress).toBe(100);
  });

  it("is vacuous-100 for checklist/deliverable progress when there's nothing to track", () => {
    const progress = computeOperationalProgress({ phases: [], milestones: [], deliverables: [], checklists: [], session: { current_phase_id: null, completed_step_ids: [], completed_milestone_ids: [], completed_checklist_item_ids: [], completed_deliverable_ids: [] } });
    expect(progress.checklistProgress).toBe(100);
    expect(progress.deliverableProgress).toBe(100);
    expect(progress.currentPhaseId).toBeNull();
  });

  it("always reports evidenceProgressPlaceholder as null", () => {
    expect(computeOperationalProgress(baseInput()).evidenceProgressPlaceholder).toBeNull();
  });
});
