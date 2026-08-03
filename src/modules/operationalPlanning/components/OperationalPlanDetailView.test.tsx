import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationalPlanDetailView } from "@/modules/operationalPlanning/components/OperationalPlanDetailView";
import type { OperationalPlan, OperationalPlanResult } from "@/types/operationalPlanning";

vi.mock("@/modules/operationalPlanning/operationalPlanningActions", () => ({
  getOperationalPlanAction: vi.fn(),
  evaluateOperationalPlanAction: vi.fn(),
}));

import { getOperationalPlanAction, evaluateOperationalPlanAction } from "@/modules/operationalPlanning/operationalPlanningActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makePlan(overrides: Partial<OperationalPlan> = {}): OperationalPlan {
  return {
    id: "plan_1",
    workspace_id: "ws_1",
    name: "Amoré Wedding — Setup Plan",
    template_id: null,
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    phases: [
      {
        id: "phase_1",
        kind: "setup",
        name: "Venue Setup",
        order: 1,
        steps: [{ id: "step_1", title: "Position floral arch", description: null, instructions: null, estimated_duration_minutes: 30, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }],
      },
    ],
    milestones: [],
    deliverables: [],
    evidence_requirements: [],
    checklists: [],
    approvals: [],
    status: "draft",
    version: 1,
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    approved_at: null,
    approved_by: null,
    archived_at: null,
    ...overrides,
  };
}

const PERFECT_RESULT: OperationalPlanResult = {
  plan: makePlan(),
  validation: { valid: true, errors: [], warnings: [] },
  health: { planCompletenessScore: 100, dependencyHealthScore: 100, evidenceCoverageScore: 100, checklistCoverageScore: 100, approvalCoverageScore: 100, deliverableCoverageScore: 100, milestoneCoverageScore: 100, overallOperationalHealth: 100 },
  explanation: { summary: "This plan is fully ready — overall operational health 100/100.", missingRequirements: [], dependencyFailures: [], approvalBlockers: [], evidenceGaps: [], incompleteMilestones: [], incompleteDeliverables: [], criticalPathSummary: "30 minutes across the critical path." },
  criticalPath: { criticalStepIds: ["step_1"], blockingStepIds: [], parallelStepIds: [], optionalStepIds: [], estimatedCompletionMinutes: 30 },
};

beforeEach(() => {
  vi.mocked(getOperationalPlanAction).mockReset();
  vi.mocked(evaluateOperationalPlanAction).mockReset();
});

describe("OperationalPlanDetailView", () => {
  it("renders the plan's phases and steps", async () => {
    vi.mocked(getOperationalPlanAction).mockResolvedValue({ success: true, data: makePlan() });

    render(<OperationalPlanDetailView planId="plan_1" />);

    expect(await screen.findByText("Venue Setup")).toBeInTheDocument();
    expect(screen.getByText("Position floral arch")).toBeInTheDocument();
  });

  it("renders an error state when the plan can't be found", async () => {
    vi.mocked(getOperationalPlanAction).mockResolvedValue({ success: false, error: "This operational plan could not be found." });

    render(<OperationalPlanDetailView planId="plan_missing" />);
    expect(await screen.findByText("This operational plan could not be found.")).toBeInTheDocument();
  });

  it("re-derives and displays health/validation when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getOperationalPlanAction).mockResolvedValue({ success: true, data: makePlan() });
    vi.mocked(evaluateOperationalPlanAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<OperationalPlanDetailView planId="plan_1" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("This plan is fully ready — overall operational health 100/100.")).toBeInTheDocument();
  });
});
