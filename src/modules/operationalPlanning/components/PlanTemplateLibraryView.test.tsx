import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanTemplateLibraryView } from "@/modules/operationalPlanning/components/PlanTemplateLibraryView";
import type { PlanTemplate } from "@/types/operationalPlanning";

vi.mock("@/modules/operationalPlanning/operationalPlanningActions", () => ({
  listPlanTemplatesAction: vi.fn(),
}));

import { listPlanTemplatesAction } from "@/modules/operationalPlanning/operationalPlanningActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeTemplate(overrides: Partial<PlanTemplate> = {}): PlanTemplate {
  return {
    id: "template_1",
    workspace_id: "ws_1",
    name: "Luxury Picnic",
    category: "luxury_picnic",
    description: "A full luxury picnic setup and breakdown.",
    phases: [{ id: "phase_1", kind: "setup", name: "Setup", order: 1, steps: [{ id: "step_1", title: "Lay out blankets", description: null, instructions: null, estimated_duration_minutes: 15, dependencies: [], assigned_resource_type: null, required_capability_requirement_id: null, priority: "medium", status: "pending", notes: null }] }],
    milestones: [],
    deliverables: [],
    evidence_requirements: [],
    checklists: [],
    approvals: [],
    version: 1,
    status: "active",
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(listPlanTemplatesAction).mockReset();
});

describe("PlanTemplateLibraryView", () => {
  it("renders the template list with its structural counts", async () => {
    vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: true, data: [makeTemplate()] });
    render(<PlanTemplateLibraryView />);

    expect(await screen.findByText("Luxury Picnic")).toBeInTheDocument();
    expect(screen.getByText("A full luxury picnic setup and breakdown.")).toBeInTheDocument();
  });

  it("renders an error state when the list action fails", async () => {
    vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: false, error: "Access denied." });
    render(<PlanTemplateLibraryView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no templates", async () => {
    vi.mocked(listPlanTemplatesAction).mockResolvedValue({ success: true, data: [] });
    render(<PlanTemplateLibraryView />);
    expect(await screen.findByText("No plan templates yet")).toBeInTheDocument();
  });
});
