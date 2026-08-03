import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/clientPortal/getClientPortalProposal", () => ({
  listClientPortalProposalsAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalProposalsListView } from "@/modules/clientPortal/components/ClientPortalProposalsListView";
import { listClientPortalProposalsAction } from "@/modules/clientPortal/getClientPortalProposal";

const PROPOSAL = { proposalId: "prop_1", title: "Malibu Sunset Proposal", grandTotal_minor: 850000, currency: "USD", sentAt: "2026-01-01T00:00:00.000Z" };

describe("ClientPortalProposalsListView", () => {
  it("renders each proposal's title and formatted total", async () => {
    vi.mocked(listClientPortalProposalsAction).mockResolvedValue({ success: true, data: [PROPOSAL] } as never);
    render(<ClientPortalProposalsListView />);
    await waitFor(() => expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument());
    expect(screen.getByText("$8,500.00")).toBeInTheDocument();
  });

  it("shows an empty state when there are no proposals", async () => {
    vi.mocked(listClientPortalProposalsAction).mockResolvedValue({ success: true, data: [] } as never);
    render(<ClientPortalProposalsListView />);
    await waitFor(() => expect(screen.getByText("No proposals yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(listClientPortalProposalsAction).mockResolvedValue({ success: false, error: "boom" } as never);
    render(<ClientPortalProposalsListView />);
    await waitFor(() => expect(screen.getByText("Could not load your proposals.")).toBeInTheDocument());
  });
});
