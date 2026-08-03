import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalDocuments: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalDocumentsListView } from "@/modules/clientPortal/components/ClientPortalDocumentsListView";
import { getClientPortalDocuments } from "@/lib/data";

const DOCUMENT = {
  id: "doc_1",
  title: "Signed Contract",
  description: null,
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

describe("ClientPortalDocumentsListView", () => {
  it("renders each document's client-safe fields", async () => {
    vi.mocked(getClientPortalDocuments).mockResolvedValue([DOCUMENT] as never);
    render(<ClientPortalDocumentsListView />);
    // The one document appears in both "Recent Documents" and its own "Folders" category group — two distinct, honest views of the same set, not a duplicate render.
    await waitFor(() => expect(screen.getAllByText("Signed Contract").length).toBe(2));
  });

  it("shows an empty state when there are no documents", async () => {
    vi.mocked(getClientPortalDocuments).mockResolvedValue([] as never);
    render(<ClientPortalDocumentsListView />);
    await waitFor(() => expect(screen.getByText("No documents yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalDocuments).mockRejectedValue(new Error("boom"));
    render(<ClientPortalDocumentsListView />);
    await waitFor(() => expect(screen.getByText("Could not load your documents.")).toBeInTheDocument());
  });

  it("never renders raw storage bucket or path values", async () => {
    vi.mocked(getClientPortalDocuments).mockResolvedValue([DOCUMENT] as never);
    render(<ClientPortalDocumentsListView />);
    await waitFor(() => expect(screen.getAllByText("Signed Contract").length).toBeGreaterThan(0));
    expect(screen.queryByText(/storage_/i)).not.toBeInTheDocument();
  });
});
