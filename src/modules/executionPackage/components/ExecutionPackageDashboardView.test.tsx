import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExecutionPackageDashboardView } from "@/modules/executionPackage/components/ExecutionPackageDashboardView";
import type { EvaluateExecutionPackagePlatformHealthResult } from "@/modules/executionPackage/executionPackageActions";
import type { ExecutionPackage } from "@/types/executionPackage";

vi.mock("@/modules/executionPackage/executionPackageActions", () => ({
  listExecutionPackagesAction: vi.fn(),
  evaluateExecutionPackagePlatformHealthAction: vi.fn(),
}));

import { listExecutionPackagesAction, evaluateExecutionPackagePlatformHealthAction } from "@/modules/executionPackage/executionPackageActions";

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
        snapshot: { id: "snapshot_1", captured_at: NOW, allocation_id: null, allocation_strategy: null, allocation_candidates: [], appointment_id: null, scheduled_starts_at: null, scheduled_ends_at: null, calendar_id: null, operational_plan_id: null, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], bundle_id: null, bundle_snapshot: null, dependency_checks: [], resource_pool: null },
        instructions: { sections: [], safety_notes: [], customer_notes: [], equipment_notes: [], vehicle_notes: [], special_instructions: [] },
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

function makeHealth(overrides: Partial<EvaluateExecutionPackagePlatformHealthResult> = {}): EvaluateExecutionPackagePlatformHealthResult {
  return { packages: [], findings: [], healthByPackageId: {}, readinessByPackageId: {}, ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateExecutionPackagePlatformHealthResult> = {}) {
  vi.mocked(listExecutionPackagesAction).mockResolvedValue({ success: true, data: [makePackage()] });
  vi.mocked(evaluateExecutionPackagePlatformHealthAction).mockResolvedValue({ success: true, data: makeHealth({ packages: [makePackage()], ...overrides }) });
}

beforeEach(() => {
  vi.mocked(listExecutionPackagesAction).mockReset();
  vi.mocked(evaluateExecutionPackagePlatformHealthAction).mockReset();
});

describe("ExecutionPackageDashboardView", () => {
  it("renders KPI cards and the packages list once data resolves", async () => {
    mockAllSucceed();
    render(<ExecutionPackageDashboardView />);

    expect(await screen.findByText("Amoré Wedding — Execution Package")).toBeInTheDocument();
    expect(screen.getByText("No high-severity findings.")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listExecutionPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateExecutionPackagePlatformHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<ExecutionPackageDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "planning_risk", severity: "high", description: "This package is missing a fundamental planning pillar.", relatedPackageId: "package_1" }] });
    render(<ExecutionPackageDashboardView />);
    expect(await screen.findByText("This package is missing a fundamental planning pillar.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no execution packages", async () => {
    vi.mocked(listExecutionPackagesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateExecutionPackagePlatformHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<ExecutionPackageDashboardView />);
    expect(await screen.findByText("No execution packages yet")).toBeInTheDocument();
  });
});
