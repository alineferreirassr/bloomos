import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentsListView } from "@/modules/documents/components/DocumentsListView";
import { makeDocument } from "@/modules/documents/testUtils";
import { MemberSessionProvider } from "@/components/providers/MemberSessionProvider";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

const fullPermissionSnapshot: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_amore_bloom", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["documents.view", "documents.create", "documents.update", "documents.archive"],
  workspaceDisplayName: "Amoré Bloom",
};

function renderDocumentsListView(props?: Parameters<typeof DocumentsListView>[0]) {
  return render(
    <MemberSessionProvider snapshot={fullPermissionSnapshot}>
      <DocumentsListView {...props} />
    </MemberSessionProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getContracts: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getDocumentFolders: vi.fn(),
  getDocumentNextAction: vi.fn(),
  getDocuments: vi.fn(),
  getEvents: vi.fn(),
  getExpenses: vi.fn(),
  getInvoices: vi.fn(),
  getPayments: vi.fn(),
}));

vi.mock("@/modules/documents/documentActions", () => ({
  createDocumentFolderAction: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

function mockCommon() {
  vi.mocked(dataLayer.getClients).mockResolvedValue([]);
  vi.mocked(dataLayer.getContracts).mockResolvedValue([]);
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getExpenses).mockResolvedValue([]);
  vi.mocked(dataLayer.getInvoices).mockResolvedValue([]);
  vi.mocked(dataLayer.getPayments).mockResolvedValue([]);
  vi.mocked(dataLayer.getDocumentFolders).mockResolvedValue([]);
  vi.mocked(dataLayer.getDocumentNextAction).mockResolvedValue(null);
  vi.mocked(dataLayer.getDashboardMetrics).mockResolvedValue(
    [
      "Total Documents",
      "Documents Uploaded This Month",
      "Storage Used",
      "Expiring Documents",
      "Expired Documents",
      "Archived Documents",
      "Client-visible Documents",
      "Team-visible Documents",
      "Documents Missing Category",
      "Documents Missing Folder",
    ].map((label) => ({ label, value: "0", href: "/documents" })),
  );
}

describe("DocumentsListView", () => {
  it("renders the ten summary cards", async () => {
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();

    expect(await screen.findByText("Total Documents")).toBeInTheDocument();
    expect(screen.getByText("Documents Missing Folder")).toBeInTheDocument();
  });

  it("renders documents returned by getDocuments", async () => {
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([
      makeDocument({ id: "document_1", title: "Insurance Cert", file_name: "insurance.pdf" }),
    ]);

    renderDocumentsListView();

    expect((await screen.findAllByText("Insurance Cert")).length).toBeGreaterThan(0);
  });

  it("re-fetches with the entered search text", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();
    await waitFor(() => expect(dataLayer.getDocuments).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/search documents/i), "insurance");

    await waitFor(() =>
      expect(dataLayer.getDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ search: "insurance" })),
    );
  });

  it("re-fetches with the selected category filter", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();
    await waitFor(() => expect(dataLayer.getDocuments).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/filter by category/i), "insurance");

    await waitFor(() =>
      expect(dataLayer.getDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ category: "insurance" })),
    );
  });

  it("re-fetches with includeArchived when 'Show archived' is checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();
    await waitFor(() => expect(dataLayer.getDocuments).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /show archived/i }));

    await waitFor(() =>
      expect(dataLayer.getDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ includeArchived: true })),
    );
  });

  it("re-fetches with latestVersionOnly when checked", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();
    await waitFor(() => expect(dataLayer.getDocuments).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /latest version only/i }));

    await waitFor(() =>
      expect(dataLayer.getDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ latestVersionOnly: true })),
    );
  });

  it("prefills owner filters from initialOwnerType/initialOwnerId props", async () => {
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView({ initialOwnerType: "client", initialOwnerId: "client_2" });

    await waitFor(() =>
      expect(dataLayer.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ ownerType: "client", ownerId: "client_2" }),
      ),
    );
  });

  it("shows an empty state when no documents match", async () => {
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();

    expect(await screen.findByText(/no documents yet/i)).toBeInTheDocument();
  });

  it("shows an error state when loading fails", async () => {
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockRejectedValue(new Error("boom"));

    renderDocumentsListView();

    expect(await screen.findByText(/could not load documents/i)).toBeInTheDocument();
  });

  it("opens the New Folder modal from the list page", async () => {
    const user = userEvent.setup();
    mockCommon();
    vi.mocked(dataLayer.getDocuments).mockResolvedValue([]);

    renderDocumentsListView();
    await waitFor(() => expect(dataLayer.getDocuments).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: /new folder/i }));

    expect(await screen.findByRole("dialog", { name: /new folder/i })).toBeInTheDocument();
  });
});
