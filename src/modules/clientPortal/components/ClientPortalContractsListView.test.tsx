import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalContracts: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalContractsListView } from "@/modules/clientPortal/components/ClientPortalContractsListView";
import { getClientPortalContracts } from "@/lib/data";

const CONTRACT = {
  id: "contract_1",
  client_id: "client_1",
  event_id: null,
  contract_number: "CN-1001",
  title: "Wedding Services Agreement",
  description: null,
  status: "sent",
  signature_status: "pending",
  effective_date: null,
  expiration_date: null,
  sent_at: null,
  viewed_at: null,
  signed_at: null,
  total_value: 12000,
  deposit_required: true,
  deposit_amount: 3000,
  remaining_balance: 9000,
  currency: "USD",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ClientPortalContractsListView", () => {
  it("renders each contract's client-safe fields", async () => {
    vi.mocked(getClientPortalContracts).mockResolvedValue([CONTRACT] as never);
    render(<ClientPortalContractsListView />);
    await waitFor(() => expect(screen.getByText("Wedding Services Agreement")).toBeInTheDocument());
    expect(screen.getByText("CN-1001")).toBeInTheDocument();
  });

  it("shows an empty state when there are no contracts", async () => {
    vi.mocked(getClientPortalContracts).mockResolvedValue([] as never);
    render(<ClientPortalContractsListView />);
    await waitFor(() => expect(screen.getByText("No contracts yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalContracts).mockRejectedValue(new Error("boom"));
    render(<ClientPortalContractsListView />);
    await waitFor(() => expect(screen.getByText("Could not load your contracts.")).toBeInTheDocument());
  });
});
