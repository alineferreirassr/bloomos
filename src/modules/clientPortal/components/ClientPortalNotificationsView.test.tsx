import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  getClientPortalNotifications: vi.fn(),
  markClientPortalNotificationRead: vi.fn(),
  logClientPortalActivityForCurrentSession: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientPortalNotificationsView } from "@/modules/clientPortal/components/ClientPortalNotificationsView";
import { getClientPortalNotifications, markClientPortalNotificationRead, logClientPortalActivityForCurrentSession } from "@/lib/data";

const NOTIFICATION = {
  id: "notification_1",
  workspace_id: "ws_1",
  recipient_member_id: null,
  recipient_client_account_id: "account_1",
  title: "Welcome to your Client Portal",
  body: "You can track your event, documents, and invoices here any time.",
  read_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("ClientPortalNotificationsView", () => {
  it("reuses the shared Notification module — renders title/body/unread badge", async () => {
    vi.mocked(getClientPortalNotifications).mockResolvedValue([NOTIFICATION] as never);
    render(<ClientPortalNotificationsView />);
    await waitFor(() => expect(screen.getByText("Welcome to your Client Portal")).toBeInTheDocument());
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("shows an empty state when there are no notifications", async () => {
    vi.mocked(getClientPortalNotifications).mockResolvedValue([] as never);
    render(<ClientPortalNotificationsView />);
    await waitFor(() => expect(screen.getByText("No notifications yet")).toBeInTheDocument());
  });

  it("shows an error state with retry on failure", async () => {
    vi.mocked(getClientPortalNotifications).mockRejectedValue(new Error("boom"));
    render(<ClientPortalNotificationsView />);
    await waitFor(() => expect(screen.getByText("Could not load your notifications.")).toBeInTheDocument());
  });

  it("Step 14: marking a notification read logs the activity and drops the New badge and control", async () => {
    vi.mocked(getClientPortalNotifications).mockResolvedValueOnce([NOTIFICATION] as never).mockResolvedValueOnce([
      { ...NOTIFICATION, read_at: "2026-01-02T00:00:00.000Z" },
    ] as never);
    vi.mocked(markClientPortalNotificationRead).mockResolvedValue({ success: true, data: { ...NOTIFICATION, read_at: "2026-01-02T00:00:00.000Z" } } as never);

    render(<ClientPortalNotificationsView />);
    await waitFor(() => expect(screen.getByRole("button", { name: /mark read/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /mark read/i }));

    await waitFor(() => expect(markClientPortalNotificationRead).toHaveBeenCalledWith("notification_1"));
    expect(logClientPortalActivityForCurrentSession).toHaveBeenCalledWith("notification_read", "notification_1");
    await waitFor(() => expect(screen.queryByText("New")).not.toBeInTheDocument());
  });
});
