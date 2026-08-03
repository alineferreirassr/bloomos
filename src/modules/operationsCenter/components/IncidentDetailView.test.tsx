import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncidentDetailView } from "@/modules/operationsCenter/components/IncidentDetailView";
import type { OperationalIncident } from "@/types/operationsCenter";

vi.mock("@/modules/operationsCenter/operationsCenterActions", () => ({
  getOperationalIncidentAction: vi.fn(),
  setIncidentStatusAction: vi.fn(),
}));

vi.mock("@/modules/communication/comments/commentsActions", () => ({
  getCommentsForOwnerAction: vi.fn().mockResolvedValue({ success: true, data: [] }),
  createCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));

import { getOperationalIncidentAction, setIncidentStatusAction } from "@/modules/operationsCenter/operationsCenterActions";

function makeIncident(overrides: Partial<OperationalIncident> = {}): OperationalIncident {
  return {
    id: "operational_incident_1",
    workspace_id: "ws_1",
    title: "Multiple critical alerts",
    description: "Two critical alerts opened at once.",
    severity: "critical",
    status: "open",
    source_alert_ids: ["operational_alert_1", "operational_alert_2"],
    related_dispatch_order_ids: [],
    related_field_operation_ids: ["field_operation_1"],
    related_route_plan_ids: [],
    related_worker_ids: [],
    related_vehicle_ids: [],
    related_equipment_ids: [],
    owner_member_id: null,
    resolution_notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    acknowledged_at: null,
    resolved_at: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("IncidentDetailView", () => {
  it("renders the incident's title, summary, and linked alerts", async () => {
    vi.mocked(getOperationalIncidentAction).mockResolvedValue({ success: true, data: makeIncident() });
    render(<IncidentDetailView incidentId="operational_incident_1" />);
    expect(await screen.findByRole("heading", { name: "Multiple critical alerts" })).toBeInTheDocument();
    expect(screen.getByText("Two critical alerts opened at once.")).toBeInTheDocument();
    expect(screen.getByText("operational_alert_1")).toBeInTheDocument();
    expect(screen.getByText("operational_alert_2")).toBeInTheDocument();
  });

  it("renders related field operations under Related Resources", async () => {
    vi.mocked(getOperationalIncidentAction).mockResolvedValue({ success: true, data: makeIncident() });
    render(<IncidentDetailView incidentId="operational_incident_1" />);
    await screen.findByRole("heading", { name: "Multiple critical alerts" });
    expect(screen.getByText("field_operation_1")).toBeInTheDocument();
  });

  it("shows an accessible empty state when the incident can't be found", async () => {
    vi.mocked(getOperationalIncidentAction).mockResolvedValue({ success: false, error: "This incident could not be found." });
    render(<IncidentDetailView incidentId="missing" />);
    expect(await screen.findByText("This incident could not be found.")).toBeInTheDocument();
  });

  it("acknowledges an open incident and reloads its record", async () => {
    vi.mocked(getOperationalIncidentAction).mockResolvedValueOnce({ success: true, data: makeIncident() }).mockResolvedValue({ success: true, data: makeIncident({ status: "acknowledged", acknowledged_at: "2026-01-01T00:05:00.000Z" }) });
    vi.mocked(setIncidentStatusAction).mockResolvedValue({ success: true, data: makeIncident({ status: "acknowledged", acknowledged_at: "2026-01-01T00:05:00.000Z" }) });

    const user = userEvent.setup();
    render(<IncidentDetailView incidentId="operational_incident_1" />);
    await user.click(await screen.findByRole("button", { name: "Acknowledge" }));

    await waitFor(() => expect(setIncidentStatusAction).toHaveBeenCalledWith("operational_incident_1", "acknowledged", undefined));
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
  });

  it("shows resolution notes once resolved, and hides the action buttons", async () => {
    vi.mocked(getOperationalIncidentAction).mockResolvedValue({ success: true, data: makeIncident({ status: "resolved", resolved_at: "2026-01-01T00:10:00.000Z", resolution_notes: "Confirmed closed after review." }) });
    render(<IncidentDetailView incidentId="operational_incident_1" />);
    expect(await screen.findByText("Confirmed closed after review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });
});
