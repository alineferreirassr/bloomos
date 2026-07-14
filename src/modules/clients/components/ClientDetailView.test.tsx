import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientDetailView } from "@/modules/clients/components/ClientDetailView";
import { makeClient } from "@/modules/clients/testUtils";

vi.mock("@/lib/data", () => ({
  getClientById: vi.fn(),
  getNotesByClientId: vi.fn(),
  getTimelineByClientId: vi.fn(),
  getClientNextAction: vi.fn(),
  createClientNote: vi.fn(),
  togglePinNote: vi.fn(),
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  setClientVipStatus: vi.fn(),
  updateClientStatus: vi.fn(),
  updateClientContactPreference: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ClientDetailView", () => {
  it("renders header, contact, and internal sections once the client loads", async () => {
    const client = makeClient({
      id: "client_1",
      first_name: "Naomi",
      last_name: "Whitfield",
      partner_name: "James Whitfield",
      is_vip: true,
      tags: ["repeat-client"],
      internal_status: "active",
    });
    vi.mocked(dataLayer.getClientById).mockResolvedValue(client);
    vi.mocked(dataLayer.getNotesByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientNextAction).mockResolvedValue(null);

    render(<ClientDetailView clientId="client_1" />);

    expect(await screen.findByText(/Naomi Whitfield & James Whitfield/)).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("repeat-client")).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows an error state when the client can't be found", async () => {
    vi.mocked(dataLayer.getClientById).mockRejectedValue(new Error("not found"));
    vi.mocked(dataLayer.getNotesByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByClientId).mockResolvedValue([]);
    vi.mocked(dataLayer.getClientNextAction).mockResolvedValue(null);

    render(<ClientDetailView clientId="does_not_exist" />);

    expect(await screen.findByText(/could not load this client/i)).toBeInTheDocument();
  });
});
