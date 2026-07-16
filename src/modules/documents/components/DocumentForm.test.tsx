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

async function fillMinimumValidFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/original file name/i), "contract.pdf");
  await user.type(screen.getByLabelText(/mime type/i), "application/pdf");
  await user.type(screen.getByLabelText(/size \(mb\)/i), "1");
}

describe("DocumentForm", () => {
  it("shows a metadata-only notice and no real file selector", () => {
    mockCommon();
    render(<DocumentForm onSubmit={vi.fn()} />);
    expect(screen.getByText(/this phase creates metadata only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^file$/i)).not.toBeInTheDocument();
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

  it("requires a file name, MIME type, and size before submitting", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn();
    render(<DocumentForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/file name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with the entered values on success", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: {} });
    render(<DocumentForm onSubmit={onSubmit} />);

    await fillMinimumValidFields(user);
    await user.click(screen.getByRole("button", { name: /add document/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ original_file_name: "contract.pdf", mime_type: "application/pdf", size_mb: "1" }),
      ),
    );
  });

  it("maps a blocked-extension field error from the data layer onto the file name field", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { file_name: "Unsupported or missing file extension" },
    });
    render(<DocumentForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/original file name/i), "malware.exe");
    await user.type(screen.getByLabelText(/mime type/i), "application/x-msdownload");
    await user.type(screen.getByLabelText(/size \(mb\)/i), "1");
    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/unsupported or missing file extension/i)).toBeInTheDocument();
  });

  it("maps a size_bytes field error from the data layer onto the Size (MB) field", async () => {
    const user = userEvent.setup();
    mockCommon();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { size_bytes: "File exceeds the size limit for this file type" },
    });
    render(<DocumentForm onSubmit={onSubmit} />);

    await fillMinimumValidFields(user);
    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/file exceeds the size limit/i)).toBeInTheDocument();
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

    await fillMinimumValidFields(user);
    await user.click(screen.getByRole("button", { name: /add document/i }));

    expect(await screen.findByText(/event belongs to a different client/i)).toBeInTheDocument();
  });
});
