import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getClientPortalContractById: vi.fn(),
}));

vi.mock("@/modules/clientPortal/getClientPortalContract", () => ({
  getClientPortalContractDocumentAction: vi.fn().mockResolvedValue({ success: false, error: "not available in this test" }),
  compareClientPortalContractVersionsAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalContractDetailView } from "@/modules/clientPortal/components/ClientPortalContractDetailView";
import { getClientPortalContractById } from "@/lib/data";

const CONTRACT = {
  id: "contract_1",
  client_id: "client_1",
  event_id: null,
  contract_number: "CN-1001",
  title: "Wedding Services Agreement",
  description: "Full-service coordination.",
  status: "sent",
  signature_status: "pending",
  effective_date: "2026-02-01",
  expiration_date: null,
  sent_at: "2026-01-15T00:00:00.000Z",
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

describe("ClientPortalContractDetailView", () => {
  it("renders client-safe contract fields", async () => {
    vi.mocked(getClientPortalContractById).mockResolvedValue(CONTRACT as never);
    render(<ClientPortalContractDetailView contractId="contract_1" />);
    await waitFor(() => expect(screen.getByText("Wedding Services Agreement")).toBeInTheDocument());
    expect(screen.getByText("CN-1001")).toBeInTheDocument();
  });

  it("shows a not-found state for a manipulated or inaccessible id", async () => {
    vi.mocked(getClientPortalContractById).mockRejectedValue(new NotFoundError("Contract contract_2 was not found"));
    render(<ClientPortalContractDetailView contractId="contract_2" />);
    await waitFor(() => expect(screen.getByText("This contract could not be found.")).toBeInTheDocument());
  });

  it("shows an error state with retry on an unexpected failure", async () => {
    vi.mocked(getClientPortalContractById).mockRejectedValue(new Error("boom"));
    render(<ClientPortalContractDetailView contractId="contract_1" />);
    await waitFor(() => expect(screen.getByText("Could not load this contract.")).toBeInTheDocument());
  });

  it("never renders internal notes or version-history internals", async () => {
    vi.mocked(getClientPortalContractById).mockResolvedValue(CONTRACT as never);
    render(<ClientPortalContractDetailView contractId="contract_1" />);
    await waitFor(() => expect(screen.getByText("Wedding Services Agreement")).toBeInTheDocument());
    expect(screen.queryByText(/internal/i)).not.toBeInTheDocument();
  });
});
