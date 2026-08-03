import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentsSummarySection } from "@/modules/documents/components/DocumentsSummarySection";
import { makeDocument } from "@/modules/documents/testUtils";

vi.mock("@/lib/data", () => ({
  getDocumentOwnerSummary: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("DocumentsSummarySection", () => {
  it("renders total/active/draft counts and the latest upload", async () => {
    vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue({
      total: 2,
      active: 1,
      draft: 1,
      expiringSoon: 0,
      expired: 0,
      archived: 0,
      deleted: 0,
      totalStorageBytes: 1_000_000,
      byCategory: { identification: 1, insurance: 1 } as never,
      latestUploads: [makeDocument({ id: "document_1", title: "Photo ID" })],
    });

    render(<DocumentsSummarySection ownerType="client" ownerId="client_2" />);

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(screen.getByText("Photo ID")).toBeInTheDocument();
  });

  it("shows an empty state when there are no documents yet", async () => {
    vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue({
      total: 0,
      active: 0,
      draft: 0,
      expiringSoon: 0,
      expired: 0,
      archived: 0,
      deleted: 0,
      totalStorageBytes: 0,
      byCategory: {} as never,
      latestUploads: [],
    });

    render(<DocumentsSummarySection ownerType="event" ownerId="event_1" />);

    expect(await screen.findByText(/no documents yet/i)).toBeInTheDocument();
  });

  it("links View Documents to the list page filtered to this owner", async () => {
    vi.mocked(dataLayer.getDocumentOwnerSummary).mockResolvedValue({
      total: 0,
      active: 0,
      draft: 0,
      expiringSoon: 0,
      expired: 0,
      archived: 0,
      deleted: 0,
      totalStorageBytes: 0,
      byCategory: {} as never,
      latestUploads: [],
    });

    render(<DocumentsSummarySection ownerType="event" ownerId="event_1" />);

    const link = await screen.findByRole("link", { name: /view documents/i });
    expect(link).toHaveAttribute("href", "/documents?ownerType=event&ownerId=event_1");
  });
});
