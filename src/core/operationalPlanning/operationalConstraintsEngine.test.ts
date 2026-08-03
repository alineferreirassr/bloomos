import { describe, expect, it } from "vitest";
import { validateOperationalConstraints, type OperationalConstraintsInput } from "@/core/operationalPlanning/operationalConstraintsEngine";
import type { ExecutionPhase, ExecutionStep, Milestone, Deliverable, EvidenceRequirement, ApprovalRequirement } from "@/types/operationalPlanning";

function makeStep(id: string, overrides: Partial<ExecutionStep> = {}): ExecutionStep {
  return { id, title: id, description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: "worker", required_capability_requirement_id: "req_1", priority: "medium", status: "pending", notes: null, ...overrides };
}

function makePhase(id: string, order: number, steps: ExecutionStep[]): ExecutionPhase {
  return { id, kind: "execution", name: id, order, steps };
}

function baseInput(overrides: Partial<OperationalConstraintsInput> = {}): OperationalConstraintsInput {
  return { phases: [makePhase("phase_1", 0, [makeStep("step_1")])], milestones: [], deliverables: [], evidenceRequirements: [], approvals: [], ...overrides };
}

describe("validateOperationalConstraints", () => {
  it("passes a clean, fully-specified plan", () => {
    const result = validateOperationalConstraints(baseInput());
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags a circular dependency as blocking", () => {
    const steps = [makeStep("s1", { dependencies: [{ step_id: "s2", type: "finish_to_start", dependency_class: "blocking" }] }), makeStep("s2", { dependencies: [{ step_id: "s1", type: "finish_to_start", dependency_class: "blocking" }] })];
    const result = validateOperationalConstraints(baseInput({ phases: [makePhase("phase_1", 0, steps)] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "broken_dependencies")).toBe(true);
  });

  it("flags a dangling dependency reference as blocking", () => {
    const steps = [makeStep("s1", { dependencies: [{ step_id: "s_missing", type: "finish_to_start", dependency_class: "blocking" }] })];
    const result = validateOperationalConstraints(baseInput({ phases: [makePhase("phase_1", 0, steps)] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.rule === "broken_dependencies")).toBe(true);
  });

  it("flags an orphaned milestone as blocking", () => {
    const milestones: Milestone[] = [{ id: "m1", title: "M1", target_phase_id: "phase_missing", completion_criteria: "Done", evidence_requirement_ids: [], approval_required: false, status: "not_started" }];
    const result = validateOperationalConstraints(baseInput({ milestones }));
    expect(result.errors.some((e) => e.rule === "missing_milestones")).toBe(true);
  });

  it("flags an orphaned deliverable as blocking", () => {
    const deliverables: Deliverable[] = [{ id: "d1", title: "D1", type: "document", description: null, produced_by_step_id: "step_missing", status: "pending", linked_node: null }];
    const result = validateOperationalConstraints(baseInput({ deliverables }));
    expect(result.errors.some((e) => e.rule === "missing_deliverables")).toBe(true);
  });

  it("flags an orphaned evidence requirement as blocking", () => {
    const evidenceRequirements: EvidenceRequirement[] = [{ id: "e1", type: "photo", description: "Photo", step_id: null, milestone_id: null }];
    const result = validateOperationalConstraints(baseInput({ evidenceRequirements }));
    expect(result.errors.some((e) => e.rule === "missing_evidence")).toBe(true);
  });

  it("flags pending approvals and missing resource/capability assignments as warnings, not errors", () => {
    const approvals: ApprovalRequirement[] = [{ id: "a1", type: "manager", description: "Sign-off", phase_id: null, step_id: null, milestone_id: null, status: "pending", approved_by: null, approved_at: null }];
    const phases = [makePhase("phase_1", 0, [makeStep("s1", { assigned_resource_type: null, required_capability_requirement_id: null })])];
    const result = validateOperationalConstraints(baseInput({ approvals, phases }));
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.rule).sort()).toEqual(["missing_capability", "missing_resources", "required_approvals"]);
  });
});
