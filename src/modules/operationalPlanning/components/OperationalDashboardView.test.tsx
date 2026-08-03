import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationalDashboardView } from "@/modules/operationalPlanning/components/OperationalDashboardView";
import type { EvaluateOperationalPlanningHealthResult } from "@/modules/operationalPlanning/operationalPlanningActions";
import type { OperationalPlan, PlanTemplate } from "@/types/operationalPlanning";

vi.mock("@/modules/operationalPlanning/operationalPlanningActions", () => ({
  listOperationalPlansAction: vi.fn(),
  listPlanTemplatesAction: vi.fn(),
  evaluateOperationalPlanningHealthAction: vi.fn(),
}));

import { listOperationalPlansAction, listPlanTemplatesAction, evaluateOperationalPlanningHealthAction } from "@/modules/operationalPlanning/operationalPlanningActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makePlan(overrides: Partial<OperationalPlan> = {}): OperationalPlan {
  return {
    id: "plan_1",
    workspace_id: "ws_1",
    name: "Amoré Wedding — Setup Plan",
    template_id: null,
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    phases: [],
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

function makeTemplate(overrides: Partial<PlanTemplate> = {}): PlanTemplate {
  return { id: "template_1", workspace_id: "ws_1", name: "Luxury Picnic", category: "luxury_picnic", description: null, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], version: 1, status: "active", created_by: "member_1", created_at: NOW, updated_at: NOW, archived_at: null, ...overrides };
}

function makeHealth(overrides: Partial<EvaluateOperationalPlanningHealthResult> = {}): EvaluateOperationalPlanningHealthResult {
  return { plans: [], findings: [], healthByPlanId: {}, ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateOperationalPlanningHealthResult> = {}) {
  vi.mocked(listOperationalPlansAction).mockResolvedValue({ success: true, data: [makePlan()] });
  vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: true, data: [makeTemplate()] });
  vi.mocked(evaluateOperationalPlanningHealthAction).mockResolvedValue({ success: true, data: makeHealth({ plans: [makePlan()], ...overrides }) });
}

beforeEach(() => {
  vi.mocked(listOperationalPlansAction).mockReset();
  vi.mocked(listPlanTemplatesAction).mockReset();
  vi.mocked(evaluateOperationalPlanningHealthAction).mockReset();
});

describe("OperationalDashboardView", () => {
  it("renders KPI cards and the plans list once data resolves", async () => {
    mockAllSucceed();
    render(<OperationalDashboardView />);

    expect(await screen.findByText("Amoré Wedding — Setup Plan")).toBeInTheDocument();
    expect(screen.getByText("No high-severity operational findings.")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listOperationalPlansAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateOperationalPlanningHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<OperationalDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "missing_operational_plan", severity: "high", description: "This event has no operational plan yet.", relatedPlanId: null, relatedStepId: null }] });
    render(<OperationalDashboardView />);
    expect(await screen.findByText("This event has no operational plan yet.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no operational plans", async () => {
    vi.mocked(listOperationalPlansAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateOperationalPlanningHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<OperationalDashboardView />);
    expect(await screen.findByText("No operational plans yet")).toBeInTheDocument();
  });
});
