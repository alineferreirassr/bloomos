import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalEvents: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalEventsListView } from "@/modules/clientPortal/components/ClientPortalEventsListView";
import { getClientPortalEvents } from "@/lib/data";

const EVENT = {
  id: "event_1",
  client_id: "client_1",
  title: "Beach Proposal",
  event_type: "proposal",
  status: "confirmed",
  event_date: "2099-01-01",
  start_time: null,
  end_time: null,
  timezone: null,
  location_name: "Malibu Shore",
  city: null,
  state: null,
  guest_count: null,
  package_name: null,
  theme: null,
  color_palette: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  completed_at: null,
};

describe("ClientPortalEventsListView", () => {
  it("renders each event's client-safe fields", async () => {
    vi.mocked(getClientPortalEvents).mockResolvedValue([EVENT] as never);
    render(<ClientPortalEventsListView />);
    await waitFor(() => expect(screen.getByText("Beach Proposal")).toBeInTheDocument());
    expect(screen.getByText(/Malibu Shore/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no events", async () => {
    vi.mocked(getClientPortalEvents).mockResolvedValue([] as never);
    render(<ClientPortalEventsListView />);
    await waitFor(() => expect(screen.getByText("No events yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalEvents).mockRejectedValue(new Error("boom"));
    render(<ClientPortalEventsListView />);
    await waitFor(() => expect(screen.getByText("Could not load your events.")).toBeInTheDocument());
  });

  it("never renders internal-only fields like staff assignments or internal costs", async () => {
    vi.mocked(getClientPortalEvents).mockResolvedValue([EVENT] as never);
    render(<ClientPortalEventsListView />);
    await waitFor(() => expect(screen.getByText("Beach Proposal")).toBeInTheDocument());
    expect(screen.queryByText(/assigned/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/budget/i)).not.toBeInTheDocument();
  });
});
