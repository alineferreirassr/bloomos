import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionPackageDetailView } from "@/modules/executionPackage/components/ExecutionPackageDetailView";
import type { ExecutionPackage, ExecutionPackageResult } from "@/types/executionPackage";

vi.mock("@/modules/executionPackage/executionPackageActions", () => ({
  getExecutionPackageAction: vi.fn(),
  evaluateExecutionPackageAction: vi.fn(),
}));

import { getExecutionPackageAction, evaluateExecutionPackageAction } from "@/modules/executionPackage/executionPackageActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makePackage(overrides: Partial<ExecutionPackage> = {}): ExecutionPackage {
  return {
    id: "package_1",
    workspace_id: "ws_1",
    metadata: { title: "Amoré Wedding — Execution Package", notes: null, tags: [] },
    context: { context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, customer: null, location_placeholder: null, priority: "medium" },
    source: "manual",
    status: "draft",
    current_version_id: "version_1",
    versions: [
      {
        id: "version_1",
        package_id: "package_1",
        workspace_id: "ws_1",
        version_number: 1,
        snapshot: { id: "snapshot_1", captured_at: NOW, allocation_id: "allocation_1", allocation_strategy: "highest_capability", allocation_candidates: [], appointment_id: "appointment_1", scheduled_starts_at: NOW, scheduled_ends_at: NOW, calendar_id: "calendar_1", operational_plan_id: "plan_1", phases: [], milestones: [], deliverables: [{ id: "deliverable_1", title: "Signed contract", type: "document", description: null, produced_by_step_id: null, status: "pending", linked_node: null }], evidence_requirements: [], checklists: [], approvals: [], bundle_id: null, bundle_snapshot: null, dependency_checks: [], resource_pool: null },
        instructions: { sections: [{ section: "preparation", text: "Load the van." }], safety_notes: [], customer_notes: [], equipment_notes: [], vehicle_notes: [], special_instructions: [] },
        attachments: [],
        notes: null,
        reason: null,
        created_by: "member_1",
        created_at: NOW,
      },
    ],
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    approved_at: null,
    approved_by: null,
    archived_at: null,
    ...overrides,
  };
}

const PERFECT_RESULT: ExecutionPackageResult = {
  package: makePackage(),
  version: makePackage().versions[0],
  validation: { valid: true, errors: [], warnings: [] },
  health: { planningHealth: 100, allocationHealth: 100, operationalHealth: 100, dependencyHealth: 100, bundleHealth: 100, evidenceCoverage: 100, checklistCoverage: 100, overallPackageHealth: 100 },
  explanation: { summary: "Overall package health 100/100.", whyPassed: ["Every required plan, allocation, and schedule element is present and internally consistent."], whyFailed: [], missingResources: [], missingEvidence: [], missingApprovals: [], brokenDependencies: [], missingDeliverables: [], healthCalculations: [] },
  readiness: { state: "ready", reasons: [] },
};

beforeEach(() => {
  vi.mocked(getExecutionPackageAction).mockReset();
  vi.mocked(evaluateExecutionPackageAction).mockReset();
});

describe("ExecutionPackageDetailView", () => {
  it("renders the package's title, snapshot references, and instructions", async () => {
    vi.mocked(getExecutionPackageAction).mockResolvedValue({ success: true, data: makePackage() });

    render(<ExecutionPackageDetailView packageId="package_1" />);

    expect(await screen.findByRole("heading", { name: "Amoré Wedding — Execution Package" })).toBeInTheDocument();
    expect(screen.getByText("allocation_1")).toBeInTheDocument();
    expect(screen.getByText("Load the van.")).toBeInTheDocument();
    expect(screen.getByText("Signed contract")).toBeInTheDocument();
  });

  it("renders an error state when the package can't be found", async () => {
    vi.mocked(getExecutionPackageAction).mockResolvedValue({ success: false, error: "This execution package could not be found." });

    render(<ExecutionPackageDetailView packageId="package_missing" />);
    expect(await screen.findByText("This execution package could not be found.")).toBeInTheDocument();
  });

  it("re-derives and displays health/validation/readiness when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getExecutionPackageAction).mockResolvedValue({ success: true, data: makePackage() });
    vi.mocked(evaluateExecutionPackageAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<ExecutionPackageDetailView packageId="package_1" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("Overall package health 100/100.")).toBeInTheDocument();
    expect(screen.getByText("Readiness: ready")).toBeInTheDocument();
  });
});
