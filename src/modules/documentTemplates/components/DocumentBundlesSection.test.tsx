import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentBundlesSection } from "@/modules/documentTemplates/components/DocumentBundlesSection";
import type { DocumentBundle } from "@/types/documentPlatform";

vi.mock("@/modules/documentTemplates/documentBundleActions", () => ({
  createDocumentBundleAction: vi.fn(),
  listDocumentBundlesForClientAction: vi.fn(),
}));

import { createDocumentBundleAction, listDocumentBundlesForClientAction } from "@/modules/documentTemplates/documentBundleActions";

function makeBundle(overrides: Partial<DocumentBundle> = {}): DocumentBundle {
  return {
    id: "bundle_1",
    workspaceId: "ws_1",
    clientId: "client_1",
    eventId: null,
    title: "Wedding Packet",
    description: "",
    status: "ready",
    items: [{ id: "item_1", kind: "proposal", refId: "proposal_1", addedAt: "2026-08-01T00:00:00.000Z" }],
    createdBy: "member_1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    sentAt: null,
    ...overrides,
  };
}

describe("DocumentBundlesSection", () => {
  it("renders a loading skeleton before data resolves", () => {
    vi.mocked(listDocumentBundlesForClientAction).mockReturnValue(new Promise(() => {}));

    render(<DocumentBundlesSection clientId="client_1" />);

    expect(screen.getByText("Document Bundles")).toBeInTheDocument();
  });

  it("shows an inline error message when the fetch fails", async () => {
    vi.mocked(listDocumentBundlesForClientAction).mockResolvedValue({ success: false, error: "boom" });

    render(<DocumentBundlesSection clientId="client_1" />);

    expect(await screen.findByText("Could not load document bundles.")).toBeInTheDocument();
  });

  it("shows the empty state when there are no bundles", async () => {
    vi.mocked(listDocumentBundlesForClientAction).mockResolvedValue({ success: true, data: [] });

    render(<DocumentBundlesSection clientId="client_1" />);

    expect(await screen.findByText("No document bundles yet.")).toBeInTheDocument();
  });

  it("renders a populated bundle with its link, item count, and status", async () => {
    vi.mocked(listDocumentBundlesForClientAction).mockResolvedValue({ success: true, data: [makeBundle()] });

    render(<DocumentBundlesSection clientId="client_1" />);

    const link = await screen.findByRole("link", { name: /Wedding Packet/ });
    expect(link).toHaveAttribute("href", "/documents/bundles/bundle_1");
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("creates a new bundle and refetches the list", async () => {
    vi.mocked(listDocumentBundlesForClientAction).mockResolvedValueOnce({ success: true, data: [] });
    vi.mocked(createDocumentBundleAction).mockResolvedValue({ success: true, data: makeBundle({ id: "bundle_2", title: "New Document Bundle" }) });
    vi.mocked(listDocumentBundlesForClientAction).mockResolvedValueOnce({ success: true, data: [makeBundle({ id: "bundle_2", title: "New Document Bundle" })] });

    render(<DocumentBundlesSection clientId="client_1" />);
    await screen.findByText("No document bundles yet.");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "New Bundle" }));

    expect(createDocumentBundleAction).toHaveBeenCalledWith({ clientId: "client_1", eventId: null, title: "New Document Bundle", description: "" });
    expect(await screen.findByText("New Document Bundle")).toBeInTheDocument();
  });
});
