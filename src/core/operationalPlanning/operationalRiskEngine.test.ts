import { describe, expect, it } from "vitest";
import { detectOperationalRisks, type DetectOperationalRisksInput } from "@/core/operationalPlanning/operationalRiskEngine";
import type { OperationalPlan, OperationalValidationResult, OperationalHealthScores, PlanStatus, ApprovalRequirement } from "@/types/operationalPlanning";

const NOW = "2026-01-01T00:00:00.000Z";

function makePlan(overrides: Partial<OperationalPlan> = {}): OperationalPlan {
  return { id: "plan_1", workspace_id: "ws_1", name: "Wedding Proposal Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], status: "draft", version: 1, created_by: "member_1", created_at: NOW, updated_at: NOW, approved_at: null, approved_by: null, archived_at: null, ...overrides };
}

const validResult: OperationalValidationResult = { valid: true, errors: [], warnings: [] };
const perfectHealth: OperationalHealthScores = { planCompletenessScore: 100, dependencyHealthScore: 100, evidenceCoverageScore: 100, checklistCoverageScore: 100, approvalCoverageScore: 100, deliverableCoverageScore: 100, milestoneCoverageScore: 100, overallOperationalHealth: 100 };

function baseInput(overrides: Partial<DetectOperationalRisksInput> = {}): DetectOperationalRisksInput {
  return { plans: [makePlan()], validationResultsByPlanId: new Map([["plan_1", validResult]]), healthByPlanId: new Map([["plan_1", perfectHealth]]), complexityByPlanId: new Map([["plan_1", 0]]), contextsWithoutPlan: [], ...overrides };
}

describe("detectOperationalRisks — missing_operational_plan", () => {
  it("flags a context with no operational plan", () => {
    const findings = detectOperationalRisks(baseInput({ contextsWithoutPlan: [{ nodeType: "event", nodeId: "event_2" }] }));
    expect(findings.some((f) => f.type === "missing_operational_plan")).toBe(true);
  });
});

describe("detectOperationalRisks — missing_evidence / missing_deliverables / critical_dependency", () => {
  it("flags each when the validation result carries the matching rule", () => {
    const validation: OperationalValidationResult = { valid: false, errors: [{ rule: "missing_evidence", detail: "orphaned" }, { rule: "missing_deliverables", detail: "orphaned" }, { rule: "broken_dependencies", detail: "cycle" }], warnings: [] };
    const findings = detectOperationalRisks(baseInput({ validationResultsByPlanId: new Map([["plan_1", validation]]) }));
    expect(findings.some((f) => f.type === "missing_evidence")).toBe(true);
    expect(findings.some((f) => f.type === "missing_deliverables")).toBe(true);
    expect(findings.some((f) => f.type === "critical_dependency")).toBe(true);
    expect(findings.some((f) => f.type === "incomplete_plan")).toBe(true);
  });
});

describe("detectOperationalRisks — approval_bottleneck", () => {
  it("flags a plan with 3+ approvals pending at once", () => {
    const approvals: ApprovalRequirement[] = Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, type: "manager", description: "Sign-off", phase_id: null, step_id: null, milestone_id: null, status: "pending", approved_by: null, approved_at: null }));
    const findings = detectOperationalRisks(baseInput({ plans: [makePlan({ approvals })] }));
    expect(findings.some((f) => f.type === "approval_bottleneck")).toBe(true);
  });
});

describe("detectOperationalRisks — incomplete_plan (low health, not just invalid)", () => {
  it("flags a valid plan whose health is still below the threshold", () => {
    const lowHealth: OperationalHealthScores = { ...perfectHealth, overallOperationalHealth: 40 };
    const findings = detectOperationalRisks(baseInput({ healthByPlanId: new Map([["plan_1", lowHealth]]) }));
    expect(findings.some((f) => f.type === "incomplete_plan")).toBe(true);
  });

  it("never flags a valid, healthy plan", () => {
    const findings = detectOperationalRisks(baseInput());
    expect(findings.some((f) => f.type === "incomplete_plan")).toBe(false);
  });
});

describe("detectOperationalRisks — high_operational_complexity", () => {
  it("flags a plan at/above the complexity threshold", () => {
    const findings = detectOperationalRisks(baseInput({ complexityByPlanId: new Map([["plan_1", 60]]) }));
    expect(findings.some((f) => f.type === "high_operational_complexity")).toBe(true);
  });
});

describe("detectOperationalRisks — missing_checklist", () => {
  it("flags an active plan with zero checklists", () => {
    const findings = detectOperationalRisks(baseInput({ plans: [makePlan({ status: "active" as PlanStatus, checklists: [] })] }));
    expect(findings.some((f) => f.type === "missing_checklist")).toBe(true);
  });

  it("never flags a draft plan for missing a checklist", () => {
    const findings = detectOperationalRisks(baseInput({ plans: [makePlan({ status: "draft" })] }));
    expect(findings.some((f) => f.type === "missing_checklist")).toBe(false);
  });
});
