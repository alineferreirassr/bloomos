import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationPreferencesView } from "@/modules/notifications/components/NotificationPreferencesView";
import type { NotificationPreferences } from "@/types/communication";
import type { NotificationWorkspaceDefaultsView } from "@/modules/notifications/notificationPlatformActions";

vi.mock("@/modules/notifications/notificationPlatformActions", () => ({
  getNotificationPreferencesForCurrentMemberAction: vi.fn(),
  updateNotificationPreferencesForCurrentMemberAction: vi.fn(),
  getNotificationWorkspaceDefaultsAction: vi.fn(),
}));

import {
  getNotificationPreferencesForCurrentMemberAction,
  updateNotificationPreferencesForCurrentMemberAction,
  getNotificationWorkspaceDefaultsAction,
} from "@/modules/notifications/notificationPlatformActions";

function makePreferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    workspace_id: "ws_1",
    member_id: "member_1",
    desktop_enabled: true,
    in_app_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    push_enabled: false,
    quiet_hours: { enabled: false, startHour: 22, endHour: 7 },
    muted_categories: [],
    minimum_priority: "low",
    digest_frequency: "daily",
    ...overrides,
  };
}

function makeWorkspaceDefaults(overrides: Partial<NotificationWorkspaceDefaultsView> = {}): NotificationWorkspaceDefaultsView {
  return {
    workspaceDefaults: { emailEnabled: false, inAppEnabled: true, pushEnabled: false, digestFrequency: "daily", criticalAlertsBypassDigest: false },
    channelReadiness: [{ channel: "in_app", configured: true, reason: null }],
    ...overrides,
  };
}

function mockReady(preferences: NotificationPreferences = makePreferences(), workspace: NotificationWorkspaceDefaultsView = makeWorkspaceDefaults()) {
  vi.mocked(getNotificationPreferencesForCurrentMemberAction).mockResolvedValue({ success: true, data: preferences });
  vi.mocked(getNotificationWorkspaceDefaultsAction).mockResolvedValue({ success: true, data: workspace });
}

describe("NotificationPreferencesView", () => {
  it("renders the page header while loading", () => {
    vi.mocked(getNotificationPreferencesForCurrentMemberAction).mockReturnValue(new Promise(() => {}));
    vi.mocked(getNotificationWorkspaceDefaultsAction).mockReturnValue(new Promise(() => {}));

    render(<NotificationPreferencesView />);

    expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
  });

  it("shows an error state when the preferences fetch fails", async () => {
    vi.mocked(getNotificationPreferencesForCurrentMemberAction).mockResolvedValue({ success: false, error: "Notifications aren't available. You may not have access to them." });
    vi.mocked(getNotificationWorkspaceDefaultsAction).mockResolvedValue({ success: true, data: makeWorkspaceDefaults() });

    render(<NotificationPreferencesView />);

    expect(await screen.findByText("Notifications aren't available. You may not have access to them.")).toBeInTheDocument();
  });

  it("renders channel, quiet-hours, and workspace-default values from the fixture", async () => {
    mockReady(makePreferences({ desktop_enabled: true, in_app_enabled: false, quiet_hours: { enabled: true, startHour: 22, endHour: 7 } }));

    render(<NotificationPreferencesView />);

    expect(await screen.findByLabelText("Desktop")).toBeChecked();
    expect(screen.getByLabelText("In-App")).not.toBeChecked();
    expect(screen.getByText(/22:00–7:00/)).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum priority to notify on")).toHaveValue("low");
    expect(screen.getByText("Digest frequency")).toBeInTheDocument();
    expect(screen.getByText("Email enabled workspace-wide")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument(); // in_app channel readiness
  });

  it("toggles the Desktop channel and reflects the returned preference", async () => {
    mockReady(makePreferences({ desktop_enabled: true }));
    vi.mocked(updateNotificationPreferencesForCurrentMemberAction).mockResolvedValue({ success: true, data: makePreferences({ desktop_enabled: false }) });

    render(<NotificationPreferencesView />);

    const desktopCheckbox = await screen.findByLabelText("Desktop");
    expect(desktopCheckbox).toBeChecked();

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(desktopCheckbox);

    expect(updateNotificationPreferencesForCurrentMemberAction).toHaveBeenCalledWith({ desktopEnabled: false });
    expect(await screen.findByLabelText("Desktop")).not.toBeChecked();
  });

  it("mutes a category and reflects the returned aria-pressed state", async () => {
    mockReady(makePreferences({ muted_categories: [] }));
    vi.mocked(updateNotificationPreferencesForCurrentMemberAction).mockResolvedValue({ success: true, data: makePreferences({ muted_categories: ["finance"] }) });

    render(<NotificationPreferencesView />);

    const financeToggle = await screen.findByRole("button", { name: "Finance" });
    expect(financeToggle).toHaveAttribute("aria-pressed", "false");

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(financeToggle);

    expect(updateNotificationPreferencesForCurrentMemberAction).toHaveBeenCalledWith({ mutedCategories: ["finance"] });
    expect(await screen.findByRole("button", { name: "Finance" })).toHaveAttribute("aria-pressed", "true");
  });
});
