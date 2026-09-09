import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentBundleDetailView } from "@/modules/documentTemplates/components/DocumentBundleDetailView";
import type { DocumentBundle, DocumentBundleHealth, ResolvedDocumentBundleItem } from "@/types/documentPlatform";
import type { DocumentBundleDetail } from "@/modules/documentTemplates/documentBundleActions";

vi.mock("@/modules/documentTemplates/documentBundleActions", () => ({
  getDocumentBundleDetailAction: vi.fn(),
  removeDocumentBundleItemAction: vi.fn(),
  updateDocumentBundleStatusAction: vi.fn(),
}));

import {
  getDocumentBundleDetailAction,
  removeDocumentBundleItemAction,
  updateDocumentBundleStatusAction,
} from "@/modules/documentTemplates/documentBundleActions";

function makeBundle(overrides: Partial<DocumentBundle> = {}): DocumentBundle {
  return {
    id: "bundle_1",
    workspaceId: "ws_1",
    clientId: "client_1",
    eventId: null,
    title: "Wedding Packet",
    description: "Everything for Casey's wedding.",
    status: "ready",
    items: [{ id: "item_1", kind: "proposal", refId: "proposal_1", addedAt: "2026-08-01T00:00:00.000Z" }],
    createdBy: "member_1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    sentAt: null,
    ...overrides,
  };
}

function makeHealth(overrides: Partial<DocumentBundleHealth> = {}): DocumentBundleHealth {
  return {
    categories: [
      { category: "completeness", score: 80, issues: [], notApplicableReason: null },
      { category: "client_link", score: null, issues: [], notApplicableReason: "No client linked." },
    ],
    overallScore: 80,
    evaluatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function makeResolvedItem(overrides: Partial<ResolvedDocumentBundleItem> = {}): ResolvedDocumentBundleItem {
  return {
    item: { id: "item_1", kind: "proposal", refId: "proposal_1", addedAt: "2026-08-01T00:00:00.000Z" },
    title: "Wedding Proposal",
    subtitle: "Sent 2026-08-01",
    available: true,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<DocumentBundleDetail> = {}): DocumentBundleDetail {
  return {
    bundle: makeBundle(),
    resolvedItems: [makeResolvedItem()],
    health: makeHealth(),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("DocumentBundleDetailView", () => {
  it("does not render bundle content before data resolves", () => {
    vi.mocked(getDocumentBundleDetailAction).mockReturnValue(new Promise(() => {}));

    render(<DocumentBundleDetailView bundleId="bundle_1" />);

    expect(screen.queryByText("Wedding Packet")).not.toBeInTheDocument();
    expect(screen.queryByText("Could not load this document bundle.")).not.toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    vi.mocked(getDocumentBundleDetailAction).mockResolvedValue({ success: false, error: "boom" });

    render(<DocumentBundleDetailView bundleId="bundle_1" />);

    expect(await screen.findByText("Could not load this document bundle.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders the populated bundle: status, item count, health, and items", async () => {
    vi.mocked(getDocumentBundleDetailAction).mockResolvedValue({ success: true, data: makeDetail() });

    render(<DocumentBundleDetailView bundleId="bundle_1" />);

    expect(await screen.findByText("Wedding Packet")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Overall health" })).toBeInTheDocument();
    expect(screen.getByText("Wedding Proposal")).toBeInTheDocument();
  });

  it("advances the bundle status and refetches", async () => {
    vi.mocked(getDocumentBundleDetailAction).mockResolvedValue({ success: true, data: makeDetail({ bundle: makeBundle({ status: "ready" }) }) });
    vi.mocked(updateDocumentBundleStatusAction).mockResolvedValue({ success: true, data: makeBundle({ status: "sent" }) });

    render(<DocumentBundleDetailView bundleId="bundle_1" />);
    await screen.findByText("Wedding Packet");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Mark Sent" }));

    expect(updateDocumentBundleStatusAction).toHaveBeenCalledWith("bundle_1", "sent");
    expect(getDocumentBundleDetailAction).toHaveBeenCalledTimes(2);
  });

  it("removes an item and refetches", async () => {
    vi.mocked(getDocumentBundleDetailAction).mockResolvedValue({ success: true, data: makeDetail() });
    vi.mocked(removeDocumentBundleItemAction).mockResolvedValue({ success: true, data: makeBundle({ items: [] }) });

    render(<DocumentBundleDetailView bundleId="bundle_1" />);
    await screen.findByText("Wedding Proposal");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(removeDocumentBundleItemAction).toHaveBeenCalledWith("bundle_1", "item_1");
    expect(getDocumentBundleDetailAction).toHaveBeenCalledTimes(2);
  });

  it("hides the advance-status action at the terminal viewed state", async () => {
    vi.mocked(getDocumentBundleDetailAction).mockResolvedValue({ success: true, data: makeDetail({ bundle: makeBundle({ status: "viewed" }) }) });

    render(<DocumentBundleDetailView bundleId="bundle_1" />);

    await screen.findByText("Wedding Packet");
    expect(screen.queryByRole("button", { name: /^Mark /i })).not.toBeInTheDocument();
  });
});
