import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/clientPortal/getClientPortalProposal", () => ({
  getClientPortalProposalAction: vi.fn(),
  compareClientPortalProposalVersionsAction: vi.fn(),
  requestProposalRevisionAction: vi.fn(),
  submitClientProposalResponseAction: vi.fn(),
  toggleFavoriteProposalAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalProposalDetailView } from "@/modules/clientPortal/components/ClientPortalProposalDetailView";
import { getClientPortalProposalAction } from "@/modules/clientPortal/getClientPortalProposal";

const PROPOSAL = {
  proposalId: "prop_1",
  title: "Malibu Sunset Proposal",
  heroHeadline: "An unforgettable sunset proposal on the California coast.",
  clientResponse: null,
  currentVersionNumber: 2,
  availableVersionNumbers: [1, 2],
  pricing: { grandTotal_minor: 850000, depositDue_minor: 250000, remainingBalance_minor: 600000, currency: "USD" },
  revisionRequestedAt: null,
  favorited: false,
};

describe("ClientPortalProposalDetailView", () => {
  it("renders the proposal title, status, and pricing", async () => {
    vi.mocked(getClientPortalProposalAction).mockResolvedValue({ success: true, data: PROPOSAL } as never);
    render(<ClientPortalProposalDetailView proposalId="prop_1" />);
    await waitFor(() => expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument());
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("$8,500.00")).toBeInTheDocument();
  });

  it("shows the compare-versions controls only when more than one version exists", async () => {
    vi.mocked(getClientPortalProposalAction).mockResolvedValue({ success: true, data: { ...PROPOSAL, availableVersionNumbers: [1] } } as never);
    render(<ClientPortalProposalDetailView proposalId="prop_1" />);
    await waitFor(() => expect(screen.getByText("Malibu Sunset Proposal")).toBeInTheDocument());
    expect(screen.queryByText("Compare Versions")).not.toBeInTheDocument();
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalProposalAction).mockResolvedValue({ success: false, error: "boom" } as never);
    render(<ClientPortalProposalDetailView proposalId="prop_1" />);
    await waitFor(() => expect(screen.getByText("Could not load this proposal.")).toBeInTheDocument());
  });
});
