import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationDashboardView } from "@/modules/notifications/components/NotificationDashboardView";
import type { Notification } from "@/core/notifications/types";
import type { NotificationDashboardData } from "@/modules/notifications/notificationPlatformActions";

vi.mock("@/modules/notifications/notificationPlatformActions", () => ({
  getNotificationDashboardDataAction: vi.fn(),
  markNotificationReadAction: vi.fn(),
  markNotificationUnreadAction: vi.fn(),
  pinNotificationAction: vi.fn(),
  unpinNotificationAction: vi.fn(),
  dismissNotificationAction: vi.fn(),
  evaluateNotificationAnalyticsAction: vi.fn(),
  evaluateNotificationHealthAction: vi.fn(),
}));

import {
  getNotificationDashboardDataAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  pinNotificationAction,
  unpinNotificationAction,
  dismissNotificationAction,
  evaluateNotificationAnalyticsAction,
  evaluateNotificationHealthAction,
} from "@/modules/notifications/notificationPlatformActions";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification_1",
    workspace_id: "ws_1",
    recipient_member_id: "member_1",
    recipient_client_account_id: null,
    channel: "in_app",
    title: "New lead",
    body: "Jane Doe just submitted an inquiry.",
    read_at: null,
    created_at: "2026-08-15T09:00:00.000Z",
    related_owner_type: null,
    related_owner_id: null,
    kind: "lead_created",
    priority: "high",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

function makeDashboardData(overrides: Partial<NotificationDashboardData> = {}): NotificationDashboardData {
  return {
    notifications: [],
    unreadCount: 0,
    todayCount: 0,
    highPriorityCount: 0,
    pinnedCount: 0,
    archivedCount: 0,
    templates: [],
    recentActivity: [],
    ...overrides,
  };
}

function mockDefaults() {
  vi.mocked(evaluateNotificationAnalyticsAction).mockResolvedValue({ success: false, error: "not needed for this test" });
  vi.mocked(evaluateNotificationHealthAction).mockResolvedValue({ success: false, error: "not needed for this test" });
  vi.mocked(markNotificationReadAction).mockResolvedValue({ success: true, data: makeNotification({ read_at: "2026-08-15T09:05:00.000Z" }) });
  vi.mocked(markNotificationUnreadAction).mockResolvedValue({ success: true, data: makeNotification() });
  vi.mocked(pinNotificationAction).mockResolvedValue({ success: true, data: makeNotification({ pinned_at: "2026-08-15T09:05:00.000Z" }) });
  vi.mocked(unpinNotificationAction).mockResolvedValue({ success: true, data: makeNotification() });
  vi.mocked(dismissNotificationAction).mockResolvedValue({ success: true, data: makeNotification({ archived_at: "2026-08-15T09:05:00.000Z" }) });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("NotificationDashboardView", () => {
  it("renders the page header while loading", () => {
    mockDefaults();
    vi.mocked(getNotificationDashboardDataAction).mockReturnValue(new Promise(() => {}));

    render(<NotificationDashboardView />);

    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("shows an error state and refetches when Try again is clicked", async () => {
    mockDefaults();
    vi.mocked(getNotificationDashboardDataAction).mockResolvedValue({ success: false, error: "Could not load notifications." });

    render(<NotificationDashboardView />);

    expect(await screen.findByText("Could not load notifications.")).toBeInTheDocument();
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(getNotificationDashboardDataAction).toHaveBeenCalledTimes(2);
  });

  it("shows the KPI strip and the default unread empty state when there are no notifications", async () => {
    mockDefaults();
    vi.mocked(getNotificationDashboardDataAction).mockResolvedValue({
      success: true,
      data: makeDashboardData({ unreadCount: 0, todayCount: 0, highPriorityCount: 0, pinnedCount: 0, archivedCount: 0 }),
    });

    render(<NotificationDashboardView />);

    // "Unread"/"Today"/"High Priority"/"Pinned"/"Archived" each legitimately appear twice
    // (once as a KPI card label, once as a tab label) — assert presence, not uniqueness.
    expect((await screen.findAllByText("Unread")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High Priority").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pinned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(0);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders a populated notification and marks it read", async () => {
    mockDefaults();
    const notification = makeNotification({ id: "notification_42", title: "New lead", body: "Jane Doe just submitted an inquiry.", priority: "high", pinned_at: null });
    vi.mocked(getNotificationDashboardDataAction).mockResolvedValue({ success: true, data: makeDashboardData({ notifications: [notification], unreadCount: 1 }) });

    render(<NotificationDashboardView />);

    expect(await screen.findByText("New lead")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe just submitted an inquiry.")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }));

    expect(markNotificationReadAction).toHaveBeenCalledWith("notification_42");
  });

  it("pins and dismisses a notification", async () => {
    mockDefaults();
    const notification = makeNotification({ id: "notification_77", title: "Contract signed", pinned_at: null, archived_at: null });
    vi.mocked(getNotificationDashboardDataAction).mockResolvedValue({ success: true, data: makeDashboardData({ notifications: [notification], unreadCount: 1 }) });

    render(<NotificationDashboardView />);

    expect(await screen.findByText("Contract signed")).toBeInTheDocument();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "Pin" }));
    expect(pinNotificationAction).toHaveBeenCalledWith("notification_77");

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismissNotificationAction).toHaveBeenCalledWith("notification_77");
  });
});
