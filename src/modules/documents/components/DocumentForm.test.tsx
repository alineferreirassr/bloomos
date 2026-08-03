import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentForm } from "@/modules/documents/components/DocumentForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getContractExhibitsByContractId: vi.fn(),
  getContracts: vi.fn(),
  getDocumentFolders: vi.fn(),
  getEvents: vi.fn(),
  getExpenses: vi.fn(),
  getInvoices: vi.fn(),
  getPayments: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([
    { id: "client_2", first_name: "Jordan", last_name: "Ellis" } as never,
  ]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);
  vi.mocked(dataLayer.getPayments).mockResolvedValue([]);
  vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);
  vi.mocked(dataLayer.getDocumentFolders).mockResolvedValue([]);
  vi.mocked(dataLayer.getContractExhibitsByContractId).mockResolvedValue([]);
}

describe("DocumentForm", () => {
  it("shows a metadata-only notice and no file-metadata fields", () => {
    mockCommon();
    render(<DocumentForm onSubmit={vi.fn()} />);
    expect(screen.getByText(/creates the document's metadata record only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/original file name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/mime type/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/size \(mb\)/i)).not.toBeInTheDocument();
  });

  it("defaults to Workspace owner with the owner field disabled", () => {
    mockCommon();
    render(<DocumentForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^owner \*/i)).toBeDisabled();
  });

  it("switches to an owner select populated with clients when owner type is Client", async () => {
    const user = userEvent.setup();
    mockCommon();
    render(<DocumentForm onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/owner type/i), "client");

    const ownerSelect = await screen.findByLabelText(/^owner \*/i);
    expect(within(ownerSelect).getByRole("option", { name: /jordan ellis/i })).toBeInTheDocument();
  });

  it("submits with the default Workspace owner and no other input", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: {} });
    render(<DocumentForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add document/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ owner_type: "workspace", category: "other" })),
    );
  });

  it("surfaces an owner/reference consistency error returned by onSubmit", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { event_id: "Event belongs to a different client." },
    });
    render(<DocumentForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/event belongs to a different client/i)).toBeInTheDocument();
  });

  it("surfaces an unknown-MediaAsset error returned by onSubmit", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "Please select a valid file.",
      fieldErrors: { media_asset_id: "MediaAsset not found." },
    });
    render(<DocumentForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/please select a valid file/i)).toBeInTheDocument();
  });
});
