import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllocationRequestDetailView } from "@/modules/allocation/components/AllocationRequestDetailView";
import type { AllocationRequest, Allocation, AllocationResult } from "@/types/allocation";

vi.mock("@/modules/allocation/allocationActions", () => ({
  getAllocationRequestAction: vi.fn(),
  listAllocationsForRequestAction: vi.fn(),
  reEvaluateAllocationAction: vi.fn(),
  compareAllocationProposalsAction: vi.fn(),
}));

import { getAllocationRequestAction, listAllocationsForRequestAction, reEvaluateAllocationAction } from "@/modules/allocation/allocationActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeRequest(overrides: Partial<AllocationRequest> = {}): AllocationRequest {
  return {
    id: "request_1",
    workspace_id: "ws_1",
    context_type: "event",
    context: { nodeType: "event", nodeId: "event_1" },
    required_resources: [{ resource_type: "worker", quantity: 1, capability_requirement_id: null, preferred_resource_ids: [], notes: "Lead photographer" }],
    required_starts_at: NOW,
    required_ends_at: NOW,
    calendar_id: null,
    priority: "high",
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

function makeAllocation(overrides: Partial<Allocation> = {}): Allocation {
  return {
    id: "allocation_1",
    workspace_id: "ws_1",
    request_id: "request_1",
    group_id: "group_1",
    strategy: "highest_capability",
    status: "draft",
    candidates: [{ resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, selected: true, rejection_reason: null, is_fallback: false, fallback_tier: null }],
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    approved_at: null,
    approved_by: null,
    archived_at: null,
    ...overrides,
  };
}

const PERFECT_RESULT: AllocationResult = {
  allocation: makeAllocation(),
  scores: { capabilityFitScore: 90, scheduleFitScore: 100, availabilityFitScore: 100, bundleCompletenessScore: 100, dependencyHealthScore: 100, capacityHealthScore: 100, preferenceMatchScore: 100, overallAllocationScore: 98 },
  validation: { valid: true, errors: [], warnings: [] },
  explanation: { summary: "1 resource selected — overall allocation score 98/100.", selectedReasons: [], rejectedReasons: [], missingResources: [], constraintFailures: [], fallbacksUsed: [], bundleCompletion: "This allocation is not based on a resource bundle." },
};

beforeEach(() => {
  vi.mocked(getAllocationRequestAction).mockReset();
  vi.mocked(listAllocationsForRequestAction).mockReset();
  vi.mocked(reEvaluateAllocationAction).mockReset();
});

describe("AllocationRequestDetailView", () => {
  it("renders the request's requirement lines and its proposals", async () => {
    vi.mocked(getAllocationRequestAction).mockResolvedValue({ success: true, data: makeRequest() });
    vi.mocked(listAllocationsForRequestAction).mockResolvedValue({ success: true, data: [makeAllocation()] });

    render(<AllocationRequestDetailView requestId="request_1" />);

    expect(await screen.findByText("1× worker")).toBeInTheDocument();
    expect(screen.getByText("Lead photographer")).toBeInTheDocument();
    expect(screen.getByText("highest capability")).toBeInTheDocument();
  });

  it("renders an error state when the request can't be found", async () => {
    vi.mocked(getAllocationRequestAction).mockResolvedValue({ success: false, error: "This allocation request could not be found." });

    render(<AllocationRequestDetailView requestId="request_missing" />);
    expect(await screen.findByText("This allocation request could not be found.")).toBeInTheDocument();
  });

  it("shows an empty state when the request has no proposals yet", async () => {
    vi.mocked(getAllocationRequestAction).mockResolvedValue({ success: true, data: makeRequest() });
    vi.mocked(listAllocationsForRequestAction).mockResolvedValue({ success: true, data: [] });

    render(<AllocationRequestDetailView requestId="request_1" />);
    expect(await screen.findByText("No proposals yet")).toBeInTheDocument();
  });

  it("re-derives and displays scores when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getAllocationRequestAction).mockResolvedValue({ success: true, data: makeRequest() });
    vi.mocked(listAllocationsForRequestAction).mockResolvedValue({ success: true, data: [makeAllocation()] });
    vi.mocked(reEvaluateAllocationAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<AllocationRequestDetailView requestId="request_1" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("1 resource selected — overall allocation score 98/100.")).toBeInTheDocument();
  });
});
