import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/modules/clientPortal/getClientPortalContract", () => ({
  getClientPortalContractDocumentAction: vi.fn(),
  compareClientPortalContractVersionsAction: vi.fn(),
  requestClientPortalContractReviewAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalContractDocumentSection } from "@/modules/clientPortal/components/ClientPortalContractDocumentSection";
import { getClientPortalContractDocumentAction, requestClientPortalContractReviewAction } from "@/modules/clientPortal/getClientPortalContract";

const SUMMARY = {
  currentVersionNumber: 2,
  documentStatus: "published",
  availableVersionNumbers: [1, 2],
  sections: [{ key: "parties", title: "Parties", blocks: [{ heading: null, text: "The parties to this agreement." }] }],
  clauses: [],
  terms: "Standard terms.",
  policies: "Standard policy.",
  exhibits: [],
};

describe("ClientPortalContractDocumentSection", () => {
  it("renders the current version, sections, and terms", async () => {
    vi.mocked(getClientPortalContractDocumentAction).mockResolvedValue({ success: true, data: SUMMARY } as never);
    render(<ClientPortalContractDocumentSection contractId="contract_1" />);
    await waitFor(() => expect(screen.getByText("Contract Document")).toBeInTheDocument());
    expect(screen.getByText("The parties to this agreement.")).toBeInTheDocument();
    expect(screen.getByText("Standard terms.")).toBeInTheDocument();
  });

  it("renders nothing when the document isn't available to this client", async () => {
    vi.mocked(getClientPortalContractDocumentAction).mockResolvedValue({ success: false, error: "not available" } as never);
    const { container } = render(<ClientPortalContractDocumentSection contractId="contract_1" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("submits a review request through requestClientPortalContractReviewAction", async () => {
    const user = userEvent.setup();
    vi.mocked(getClientPortalContractDocumentAction).mockResolvedValue({ success: true, data: SUMMARY } as never);
    vi.mocked(requestClientPortalContractReviewAction).mockResolvedValue({ success: true, data: null } as never);
    render(<ClientPortalContractDocumentSection contractId="contract_1" />);
    await waitFor(() => expect(screen.getByText("Contract Document")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("What would you like reviewed?"), "Please check the deposit clause.");
    await user.click(screen.getByRole("button", { name: "Request Review" }));

    await waitFor(() => expect(screen.getByText("Your review request has been sent.")).toBeInTheDocument());
    expect(requestClientPortalContractReviewAction).toHaveBeenCalledWith("contract_1", "Please check the deposit clause.");
  });
});
