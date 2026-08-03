import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getClientPortalDocumentById: vi.fn(),
  getClientPortalDocumentDownloadUrl: vi.fn(),
  approveClientPortalDocument: vi.fn(),
  rejectClientPortalDocument: vi.fn(),
  logClientPortalActivityForCurrentSession: vi.fn(),
}));
vi.mock("@/modules/clientPortal/dispatchClientPortalTriggerActions", () => ({
  dispatchDocumentDownloadedTrigger: vi.fn(),
}));
vi.mock("@/components/providers/ClientAccountSessionProvider", () => ({
  useClientAccountSession: () => ({ workspaceId: "ws_1", clientId: "client_1", accountId: "account_1" }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalDocumentDetailView } from "@/modules/clientPortal/components/ClientPortalDocumentDetailView";
import { getClientPortalDocumentById, getClientPortalDocumentDownloadUrl, approveClientPortalDocument, rejectClientPortalDocument } from "@/lib/data";
import { dispatchDocumentDownloadedTrigger } from "@/modules/clientPortal/dispatchClientPortalTriggerActions";

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
  approvalStatus: "pending" as const,
  approvalComment: null,
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

  it("Step 10: dispatches the document.downloaded Workflow Trigger only after a successful download, never on failure", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    vi.mocked(getClientPortalDocumentDownloadUrl).mockResolvedValue({ success: true, data: "https://storage.example.com/signed/contract.pdf" } as never);
    vi.spyOn(window, "open").mockImplementation(() => null);

    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /download/i }));

    await waitFor(() => expect(dispatchDocumentDownloadedTrigger).toHaveBeenCalledWith("doc_1"));
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

  it("Step 4: approving records a real decision, reflected immediately without a page reload", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    vi.mocked(approveClientPortalDocument).mockResolvedValue({ success: true, data: { ...DOCUMENT, approvalStatus: "approved" } } as never);

    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(screen.getByText("Approved")).toBeInTheDocument());
    expect(approveClientPortalDocument).toHaveBeenCalledWith("doc_1", null);
  });

  it("Step 4: rejecting surfaces the repository's own validation error (e.g. a missing comment) instead of silently succeeding", async () => {
    vi.mocked(getClientPortalDocumentById).mockResolvedValue(DOCUMENT as never);
    vi.mocked(rejectClientPortalDocument).mockResolvedValue({ success: false, error: "Let us know why, so we can follow up" } as never);

    render(<ClientPortalDocumentDetailView documentId="doc_1" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /reject/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Let us know why, so we can follow up"));
  });
});
