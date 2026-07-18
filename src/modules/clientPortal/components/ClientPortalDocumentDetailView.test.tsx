import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getClientPortalDocumentById: vi.fn(),
  getClientPortalDocumentDownloadUrl: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalDocumentDetailView } from "@/modules/clientPortal/components/ClientPortalDocumentDetailView";
import { getClientPortalDocumentById, getClientPortalDocumentDownloadUrl } from "@/lib/data";

const DOCUMENT = {
  id: "doc_1",
  title: "Signed Contract",
  description: "Fully executed agreement.",
  category: "contract",
  status: "active",
  file_name: "contract.pdf",
  original_file_name: "contract.pdf",
  mime_type: "application/pdf",
  size_bytes: 204800,
  version: 1,
  is_latest_version: true,
  hasFile: true,
  uploaded_at: "2026-01-01T00:00:00.000Z",
  expires_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ClientPortalDocumentDetailView", () => {
  it("renders client-safe document fields", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByText("Signed Contract")).toBeInTheDocument());
  });

  it("shows a not-found state for a manipulated or inaccessible id", async () => {
    vi.mocked(getClientPortalDocumentById).mockRejectedValue(new NotFoundError("Document doc_2 was not found"));
    render(<ClientPortalDocumentDetailView documentId="doc_2" />);
    await waitFor(() => expect(screen.getByText("This document could not be found.")).toBeInTheDocument());
  });

  it("shows an error state with retry on an unexpected failure", async () => {
    vi.mocked(getClientPortalDocumentById).mockRejectedValue(new Error("boom"));
    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByText("Could not load this document.")).toBeInTheDocument());
  });

  it("shows a no-file message instead of a download action when hasFile is false", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue({ ...DOCUMENT, hasFile: false } as never);
    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByText(/No file has been attached/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("shows an expired message instead of a download action when expires_at is in the past", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue({ ...DOCUMENT, expires_at: "2020-01-01T00:00:00.000Z" } as never);
    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByText(/expired/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
  });

  it("opens the signed URL returned by the repository when Download is clicked, never a raw storage path", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    vi.mocked(getClientPortalDocumentDownloadUrl).mockResolvedValue({
      success: true,
      data: "https://storage.example.com/signed/contract.pdf?token=abc",
    } as never);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith("https://storage.example.com/signed/contract.pdf?token=abc", "_blank", "noopener,noreferrer"),
    );
  });

  it("surfaces the repository's failure message instead of opening a window when the download is rejected", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    vi.mocked(getClientPortalDocumentDownloadUrl).mockResolvedValue({
      success: false,
      error: "This document is not available.",
    } as never);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("This document is not available."));
    expect(openSpy).not.toHaveBeenCalled();
  });
});
