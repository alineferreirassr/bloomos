import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DispatchDetailView } from "@/modules/dispatch/components/DispatchDetailView";
import type { DispatchOrder, DispatchOrderResult } from "@/types/dispatch";

vi.mock("@/modules/dispatch/dispatchActions", () => ({
  getDispatchOrderAction: vi.fn(),
  evaluateDispatchOrderAction: vi.fn(),
}));

import { getDispatchOrderAction, evaluateDispatchOrderAction } from "@/modules/dispatch/dispatchActions";

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

const PERFECT_RESULT: DispatchOrderResult = {
  order: makeOrder(),
  validation: { valid: true, errors: [], warnings: [] },
  health: { assignmentCoverage: 100, acceptanceRate: 100, declineRate: 0, queueHealth: 100, pendingCount: 0, dispatchReadiness: 100, overallDispatchHealth: 100 },
  explanation: { summary: "Overall dispatch health 100/100.", whyFailed: [], whySucceeded: ["All assignments accepted."], validationFailures: [], acceptanceFailures: [], queueStatus: "1 queued", dispatchReadinessSummary: "Ready to dispatch." },
};

beforeEach(() => {
  vi.mocked(getDispatchOrderAction).mockReset();
  vi.mocked(evaluateDispatchOrderAction).mockReset();
});

describe("DispatchDetailView", () => {
  it("renders the order's id, priority, and assignments", async () => {
    vi.mocked(getDispatchOrderAction).mockResolvedValue({ success: true, data: makeOrder() });

    render(<DispatchDetailView orderId="dispatch_order_abcd1234" />);

    expect(await screen.findByRole("heading", { name: "Order #abcd1234" })).toBeInTheDocument();
    expect(screen.getByText("worker · worker_1")).toBeInTheDocument();
    expect(screen.getByText("queued")).toBeInTheDocument();
  });

  it("renders an error state when the order can't be found", async () => {
    vi.mocked(getDispatchOrderAction).mockResolvedValue({ success: false, error: "This dispatch order could not be found." });

    render(<DispatchDetailView orderId="dispatch_order_missing" />);
    expect(await screen.findByText("This dispatch order could not be found.")).toBeInTheDocument();
  });

  it("re-derives and displays health/validation when Evaluate is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    vi.mocked(getDispatchOrderAction).mockResolvedValue({ success: true, data: makeOrder() });
    vi.mocked(evaluateDispatchOrderAction).mockResolvedValue({ success: true, data: PERFECT_RESULT });

    render(<DispatchDetailView orderId="dispatch_order_abcd1234" />);
    const evaluateButton = await screen.findByRole("button", { name: "Evaluate" });
    await userEvent.click(evaluateButton);

    expect(await screen.findByText("Overall dispatch health 100/100.")).toBeInTheDocument();
    expect(screen.getByText("Queue: 1 queued")).toBeInTheDocument();
  });
});
