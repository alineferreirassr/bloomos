import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllocationDashboardView } from "@/modules/allocation/components/AllocationDashboardView";
import type { EvaluateResourceAllocationHealthResult } from "@/modules/allocation/allocationActions";
import type { AllocationRequest, ResourceBundle } from "@/types/allocation";

vi.mock("@/modules/allocation/allocationActions", () => ({
  listAllocationRequestsAction: vi.fn(),
  listResourceBundlesAction: vi.fn(),
  evaluateResourceAllocationHealthAction: vi.fn(),
}));

import { listAllocationRequestsAction, listResourceBundlesAction, evaluateResourceAllocationHealthAction } from "@/modules/allocation/allocationActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeRequest(overrides: Partial<AllocationRequest> = {}): AllocationRequest {
  return {
    id: "request_1",
    workspace_id: "ws_1",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_resources: [{ resource_type: "worker", quantity: 2, capability_requirement_id: null, preferred_resource_ids: [], notes: null }],
    required_starts_at: NOW,
    required_ends_at: NOW,
    calendar_id: null,
    priority: "medium",
    deadline: null,
    location_placeholder: null,
    special_instructions: null,
    bundle_id: null,
    source: "manual",
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<ResourceBundle> = {}): ResourceBundle {
  return { id: "bundle_1", workspace_id: "ws_1", name: "Photography Crew", description: null, required_resources: [], optional_resources: [], min_quantity: 1, max_quantity: null, status: "active", created_by: "member_1", created_at: NOW, updated_at: NOW, archived_at: null, ...overrides };
}

function makeHealth(overrides: Partial<EvaluateResourceAllocationHealthResult> = {}): EvaluateResourceAllocationHealthResult {
  return { allocations: [], requests: [], findings: [], resourcePool: { entries: [], availableCount: 3, reservedCount: 0, busyCount: 0, unavailableCount: 0, sharedCount: 0, criticalCount: 0 }, ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateResourceAllocationHealthResult> = {}) {
  vi.mocked(listAllocationRequestsAction).mockResolvedValue({ success: true, data: [makeRequest()] });
  vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: true, data: [makeBundle()] });
  vi.mocked(evaluateResourceAllocationHealthAction).mockResolvedValue({ success: true, data: makeHealth(overrides) });
}

beforeEach(() => {
  vi.mocked(listAllocationRequestsAction).mockReset();
  vi.mocked(listResourceBundlesAction).mockReset();
  vi.mocked(evaluateResourceAllocationHealthAction).mockReset();
});

describe("AllocationDashboardView", () => {
  it("renders KPI cards, the request list, and the resource pool once data resolves", async () => {
    mockAllSucceed();
    render(<AllocationDashboardView />);

    expect(await screen.findByText("event request")).toBeInTheDocument();
    expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
    expect(screen.getByText("No high-severity allocation findings.")).toBeInTheDocument();
    expect(screen.getByText("Photography Crew")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listAllocationRequestsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateResourceAllocationHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<AllocationDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "no_allocation_possible", severity: "high", description: "No resource could be allocated at all for this request.", relatedRequestId: "request_1", relatedAllocationId: null, relatedResourceId: null }] });
    render(<AllocationDashboardView />);
    expect(await screen.findByText("No resource could be allocated at all for this request.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no allocation requests", async () => {
    vi.mocked(listAllocationRequestsAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(listResourceBundlesAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateResourceAllocationHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<AllocationDashboardView />);
    expect(await screen.findByText("No allocation requests yet")).toBeInTheDocument();
  });
});
