import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/clientPortal/getClientPortalCommunicationSummary", () => ({
  getClientPortalCommunicationSummaryAction: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalCommunicationView } from "@/modules/clientPortal/components/ClientPortalCommunicationView";
import { getClientPortalCommunicationSummaryAction } from "@/modules/clientPortal/getClientPortalCommunicationSummary";

const SUMMARY = {
  unreadMessageCount: 2,
  unreadNotificationCount: 1,
  announcements: [{ id: "ann_1", workspace_id: "ws_1", author_member_id: "m1", author_name: "Ana", title: "Studio closed", body: "See you in January.", priority: "normal", audience: "all", publish_at: "2026-01-01T00:00:00.000Z", expires_at: null, requires_acknowledgement: false, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }],
  recentComments: [{ id: "cmt_1", ownerLabel: "Master Service Agreement", author: "Ana Ferreira", body: "Updated the terms per your request.", createdAt: "2026-01-02T00:00:00.000Z" }],
};

describe("ClientPortalCommunicationView", () => {
  it("renders unread counts, announcements, and comments", async () => {
    vi.mocked(getClientPortalCommunicationSummaryAction).mockResolvedValue({ success: true, data: SUMMARY } as never);
    render(<ClientPortalCommunicationView />);
    await waitFor(() => expect(screen.getByText("Studio closed")).toBeInTheDocument());
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Updated the terms per your request.")).toBeInTheDocument();
  });

  it("shows empty states for both announcements and comments when neither has data", async () => {
    vi.mocked(getClientPortalCommunicationSummaryAction).mockResolvedValue({ success: true, data: { ...SUMMARY, announcements: [], recentComments: [] } } as never);
    render(<ClientPortalCommunicationView />);
    await waitFor(() => expect(screen.getByText("No announcements")).toBeInTheDocument());
    expect(screen.getByText("No comments yet")).toBeInTheDocument();
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalCommunicationSummaryAction).mockResolvedValue({ success: false, error: "boom" } as never);
    render(<ClientPortalCommunicationView />);
    await waitFor(() => expect(screen.getByText("Could not load your communication center.")).toBeInTheDocument());
  });
});
