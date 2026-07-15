import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditContractView } from "@/modules/contracts/components/EditContractView";
import { makeContract } from "@/modules/contracts/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getContract: vi.fn(),
  updateContract: vi.fn(),
  getClients: vi.fn(),
  getContractTemplates: vi.fn(),
  getEvents: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockDeps() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([]);
  vi.mocked(dataLayer.getContractTemplates).mockResolvedValue([]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
}

describe("EditContractView", () => {
  it("preloads the form with the contract's existing data", async () => {
    mockDeps();
    vi.mocked(dataLayer.getContract).mockResolvedValue(
      makeContract({ id: "contract_1", title: "Malibu Sunset Proposal — Event Services Agreement", status: "draft" }),
    );

    render(<EditContractView contractId="contract_1" />);

    expect(await screen.findByDisplayValue("Malibu Sunset Proposal — Event Services Agreement")).toBeInTheDocument();
    expect(screen.getByText(/edit malibu sunset proposal/i)).toBeInTheDocument();
  });

  it("submits changes through updateContract, preserving the contract number implicitly (only content fields are sent)", async () => {
    const user = userEvent.setup();
    mockDeps();
    vi.mocked(dataLayer.getContract).mockResolvedValue(
      makeContract({ id: "contract_1", title: "Original Title", status: "draft" }),
    );
    vi.mocked(dataLayer.updateContract).mockResolvedValue({
      success: true,
      data: makeContract({ id: "contract_1", version: 2 }),
    });

    render(<EditContractView contractId="contract_1" />);

    const titleInput = await screen.findByDisplayValue("Original Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Title");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(dataLayer.updateContract).toHaveBeenCalledWith(
        "contract_1",
        expect.objectContaining({ title: "Updated Title" }),
      ),
    );
  });

  it("disables the Client select so it can't be changed after creation", async () => {
    mockDeps();
    vi.mocked(dataLayer.getContract).mockResolvedValue(makeContract({ id: "contract_1", status: "draft" }));

    render(<EditContractView contractId="contract_1" />);

    const clientSelect = await screen.findByLabelText(/^client\b/i);
    expect(clientSelect).toBeDisabled();
  });

  it("locks commercial-term fields for a signed contract but leaves the form usable", async () => {
    mockDeps();
    vi.mocked(dataLayer.getContract).mockResolvedValue(
      makeContract({ id: "contract_1", status: "signed", total_value: 5000 }),
    );

    render(<EditContractView contractId="contract_1" />);

    await screen.findByLabelText(/^title\b/i);
    expect(screen.getByLabelText(/total value/i)).toBeDisabled();
    expect(screen.getByLabelText(/^currency/i)).toBeDisabled();
    expect(screen.getByLabelText(/effective date/i)).toBeDisabled();
    // Title stays editable — only commercial terms are locked.
    expect(screen.getByLabelText(/^title\b/i)).not.toBeDisabled();
  });

  it("shows a read-only notice instead of a form for an archived contract", async () => {
    mockDeps();
    vi.mocked(dataLayer.getContract).mockResolvedValue(makeContract({ id: "contract_1", status: "archived" }));

    render(<EditContractView contractId="contract_1" />);

    expect(await screen.findByText(/archived and can't be edited/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^title\b/i)).not.toBeInTheDocument();
  });

  it("shows an error state when the contract can't be found", async () => {
    mockDeps();
    vi.mocked(dataLayer.getContract).mockRejectedValue(new Error("not found"));

    render(<EditContractView contractId="does_not_exist" />);

    expect(await screen.findByText(/could not load this contract/i)).toBeInTheDocument();
  });
});
