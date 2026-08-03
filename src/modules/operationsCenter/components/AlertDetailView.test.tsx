import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertDetailView } from "@/modules/operationsCenter/components/AlertDetailView";
import type { OperationalAlert } from "@/types/operationsCenter";

vi.mock("@/modules/operationsCenter/operationsCenterActions", () => ({
  getOperationalAlertAction: vi.fn(),
  acknowledgeAlertAction: vi.fn(),
  resolveAlertAction: vi.fn(),
  dismissAlertAction: vi.fn(),
  escalateAlertAction: vi.fn(),
}));

vi.mock("@/modules/communication/comments/commentsActions", () => ({
  getCommentsForOwnerAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));

import { getOperationalAlertAction, acknowledgeAlertAction } from "@/modules/operationsCenter/operationsCenterActions";

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
  return {
    id: "operational_alert_1",
    workspace_id: "ws_1",
    rule_id: "field_operations.operation_blocked",
    category: "field_operations",
    severity: "critical",
    title: "Field operation blocked",
    description: "Field operation field_operation_1 is blocked.",
    source_ref: null,
    source_record_id: "field_operation_1",
    status: "open",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_by: null,
    resolved_at: null,
    resolution_reason: null,
    dismissed_at: null,
    escalated_at: null,
    expires_at: null,
    dedupe_key: "k1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AlertDetailView", () => {
  it("renders the alert's title, description, severity, and status", async () => {
    vi.mocked(getOperationalAlertAction).mockResolvedValue({ success: true, data: makeAlert() });
    render(<AlertDetailView alertId="operational_alert_1" />);
    expect(await screen.findByRole("heading", { name: "Field operation blocked" })).toBeInTheDocument();
    expect(screen.getByText("Field operation field_operation_1 is blocked.")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the alert can't be found", async () => {
    vi.mocked(getOperationalAlertAction).mockResolvedValue({ success: false, error: "This alert could not be found." });
    render(<AlertDetailView alertId="missing" />);
    expect(await screen.findByText("This alert could not be found.")).toBeInTheDocument();
  });

  it("only offers Acknowledge for an open alert, not an already-acknowledged one", async () => {
    vi.mocked(getOperationalAlertAction).mockResolvedValue({ success: true, data: makeAlert({ status: "acknowledged", acknowledged_by: "member_1", acknowledged_at: "2026-01-01T00:05:00.000Z" }) });
    render(<AlertDetailView alertId="operational_alert_1" />);
    await screen.findByRole("heading", { name: "Field operation blocked" });
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
  });

  it("acknowledges the alert and reloads its record", async () => {
    vi.mocked(getOperationalAlertAction).mockResolvedValueOnce({ success: true, data: makeAlert() }).mockResolvedValue({ success: true, data: makeAlert({ status: "acknowledged", acknowledged_by: "member_1", acknowledged_at: "2026-01-01T00:05:00.000Z" }) });
    vi.mocked(acknowledgeAlertAction).mockResolvedValue({ success: true, data: makeAlert({ status: "acknowledged", acknowledged_by: "member_1", acknowledged_at: "2026-01-01T00:05:00.000Z" }) });

    const user = userEvent.setup();
    render(<AlertDetailView alertId="operational_alert_1" />);
    await user.click(await screen.findByRole("button", { name: "Acknowledge" }));

    await waitFor(() => expect(acknowledgeAlertAction).toHaveBeenCalledWith("operational_alert_1"));
    expect(await screen.findByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
  });

  it("shows the resolution reason once an alert is resolved", async () => {
    vi.mocked(getOperationalAlertAction).mockResolvedValue({ success: true, data: makeAlert({ status: "resolved", resolved_by: "member_1", resolved_at: "2026-01-01T00:10:00.000Z", resolution_reason: "Confirmed fixed on site." }) });
    render(<AlertDetailView alertId="operational_alert_1" />);
    expect(await screen.findByText("Confirmed fixed on site.")).toBeInTheDocument();
  });
});
