import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getClientPortalEventById: vi.fn(),
}));

vi.mock("@/modules/clientPortal/getClientPortalKnowledgeSummary", () => ({
  getClientPortalKnowledgeSummaryAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalEventDetailView } from "@/modules/clientPortal/components/ClientPortalEventDetailView";
import { getClientPortalEventById } from "@/lib/data";
import { getClientPortalKnowledgeSummaryAction } from "@/modules/clientPortal/getClientPortalKnowledgeSummary";

beforeEach(() => {
  vi.mocked(getClientPortalKnowledgeSummaryAction).mockResolvedValue({ success: true, data: { connections: [] } } as never);
});

const EVENT = {
  id: "event_1",
  client_id: "client_1",
  title: "Beach Proposal",
  event_type: "proposal",
  status: "confirmed",
  event_date: "2099-01-01",
  start_time: "17:00",
  end_time: "19:00",
  timezone: "America/Los_Angeles",
  location_name: "Malibu Shore",
  city: "Malibu",
  state: "CA",
  guest_count: 2,
  package_name: "Sunset Package",
  theme: "Coastal",
  color_palette: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  completed_at: null,
};

describe("ClientPortalEventDetailView", () => {
  it("renders client-safe event fields", async () => {
    vi.mocked(getClientPortalEventById).mockResolvedValue(EVENT as never);
    render(<ClientPortalEventDetailView eventId="event_1" />);
    await waitFor(() => expect(screen.getByText("Beach Proposal")).toBeInTheDocument());
    expect(screen.getByText("Malibu Shore")).toBeInTheDocument();
    expect(screen.getByText("Sunset Package")).toBeInTheDocument();
  });

  it("shows a not-found state for a manipulated or inaccessible id", async () => {
    vi.mocked(getClientPortalEventById).mockRejectedValue(new NotFoundError("Event event_2 was not found"));
    render(<ClientPortalEventDetailView eventId="event_2" />);
    await waitFor(() => expect(screen.getByText("This event could not be found.")).toBeInTheDocument());
  });

  it("shows an error state with retry on an unexpected failure", async () => {
    vi.mocked(getClientPortalEventById).mockRejectedValue(new Error("boom"));
    render(<ClientPortalEventDetailView eventId="event_1" />);
    await waitFor(() => expect(screen.getByText("Could not load this event.")).toBeInTheDocument());
  });

  it("never renders internal-only fields like checklist or staff assignments", async () => {
    vi.mocked(getClientPortalEventById).mockResolvedValue(EVENT as never);
    render(<ClientPortalEventDetailView eventId="event_1" />);
    await waitFor(() => expect(screen.getByText("Beach Proposal")).toBeInTheDocument());
    expect(screen.queryByText(/checklist/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();
  });
});
