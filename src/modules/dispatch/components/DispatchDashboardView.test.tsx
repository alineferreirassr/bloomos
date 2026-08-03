import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DispatchDashboardView } from "@/modules/dispatch/components/DispatchDashboardView";
import type { EvaluateDispatchPlatformHealthResult } from "@/modules/dispatch/dispatchActions";
import type { DispatchOrder } from "@/types/dispatch";

vi.mock("@/modules/dispatch/dispatchActions", () => ({
  listDispatchOrdersAction: vi.fn(),
  evaluateDispatchPlatformHealthAction: vi.fn(),
}));

import { listDispatchOrdersAction, evaluateDispatchPlatformHealthAction } from "@/modules/dispatch/dispatchActions";

const NOW = "2026-01-01T00:00:00.000Z";

function makeOrder(overrides: Partial<DispatchOrder> = {}): DispatchOrder {
  return {
    id: "dispatch_order_abcd1234",
    workspace_id: "ws_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    batch_id: null,
    status: "draft",
    priority: "medium",
    source: "execution_package_derived",
    assignments: [{ id: "assignment_1", order_id: "dispatch_order_abcd1234", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "queued", reason: null, created_at: NOW, responded_at: null, expires_at: null, attempts: [] }],
    created_by: "member_1",
    created_at: NOW,
    updated_at: NOW,
    cancelled_at: null,
    archived_at: null,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<EvaluateDispatchPlatformHealthResult> = {}): EvaluateDispatchPlatformHealthResult {
  return { results: [], findings: [], ...overrides };
}

function mockAllSucceed(overrides: Partial<EvaluateDispatchPlatformHealthResult> = {}) {
  const order = makeOrder();
  vi.mocked(listDispatchOrdersAction).mockResolvedValue({ success: true, data: [order] });
  vi.mocked(evaluateDispatchPlatformHealthAction).mockResolvedValue({
    success: true,
    data: makeHealth({
      results: [{ order, validation: { valid: true, errors: [], warnings: [] }, health: { assignmentCoverage: 100, acceptanceRate: 100, declineRate: 0, queueHealth: 100, pendingCount: 0, dispatchReadiness: 100, overallDispatchHealth: 100 }, explanation: { summary: "", whyFailed: [], whySucceeded: [], validationFailures: [], acceptanceFailures: [], queueStatus: "", dispatchReadinessSummary: "" } }],
      ...overrides,
    }),
  });
}

beforeEach(() => {
  vi.mocked(listDispatchOrdersAction).mockReset();
  vi.mocked(evaluateDispatchPlatformHealthAction).mockReset();
});

describe("DispatchDashboardView", () => {
  it("renders KPI cards and the orders list once data resolves", async () => {
    mockAllSucceed();
    render(<DispatchDashboardView />);

    expect(await screen.findByText("Order #abcd1234")).toBeInTheDocument();
    expect(screen.getByText("No high-severity findings.")).toBeInTheDocument();
  });

  it("renders an error state when the health evaluation fails", async () => {
    vi.mocked(listDispatchOrdersAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateDispatchPlatformHealthAction).mockResolvedValue({ success: false, error: "Access denied." });

    render(<DispatchDashboardView />);
    expect(await screen.findByText("Access denied.")).toBeInTheDocument();
  });

  it("surfaces a high-severity finding in its own section", async () => {
    mockAllSucceed({ findings: [{ id: "finding_1", type: "dispatch_blocked", severity: "high", description: "This order is blocked by validation issues.", relatedOrderId: "dispatch_order_abcd1234" }] });
    render(<DispatchDashboardView />);
    expect(await screen.findByText("This order is blocked by validation issues.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no dispatch orders", async () => {
    vi.mocked(listDispatchOrdersAction).mockResolvedValue({ success: true, data: [] });
    vi.mocked(evaluateDispatchPlatformHealthAction).mockResolvedValue({ success: true, data: makeHealth() });

    render(<DispatchDashboardView />);
    expect(await screen.findByText("No dispatch orders yet")).toBeInTheDocument();
  });
});
