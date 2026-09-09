import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotificationDetailView } from "@/modules/notifications/components/NotificationDetailView";
import type { Notification } from "@/core/notifications/types";
import type { NotificationDetailData } from "@/modules/notifications/notificationPlatformActions";

vi.mock("@/modules/notifications/notificationPlatformActions", () => ({
  getNotificationDetailAction: vi.fn(),
}));

import { getNotificationDetailAction } from "@/modules/notifications/notificationPlatformActions";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification_1",
    workspace_id: "ws_1",
    recipient_member_id: "member_1",
    recipient_client_account_id: null,
    channel: "in_app",
    title: "Contract signed",
    body: "Casey's contract was signed.",
    read_at: null,
    created_at: "2026-08-15T09:00:00.000Z",
    related_owner_type: "contract",
    related_owner_id: "contract_1",
    kind: "proposal_accepted",
    priority: "high",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

function makeDetailData(overrides: Partial<NotificationDetailData> = {}): NotificationDetailData {
  const notification = overrides.notification ?? makeNotification();
  return {
    notification,
    routing: {
      notificationId: notification.id,
      recipientMemberId: notification.recipient_member_id,
      recipientClientAccountId: notification.recipient_client_account_id,
      channel: notification.channel,
      priority: notification.priority,
      category: "crm",
      visible: true,
      suppressedReason: null,
      expiresAt: null,
      deliveryReadiness: [
        { channel: "in_app", configured: true, reason: null },
        { channel: "email", configured: false, reason: "No delivery provider registered for this channel yet." },
      ],
    },
    preferenceDecision: {
      channelsEnabled: ["in_app"],
      effectiveDigestFrequency: "daily",
      withinQuietHours: false,
      categoryMuted: false,
      futureChannelAvailability: [],
    },
    template: null,
    timeline: [],
    knowledgeGraphSummary: "This notification isn't linked to another record.",
    ...overrides,
  };
}

describe("NotificationDetailView", () => {
  it("renders the page header while loading", () => {
    vi.mocked(getNotificationDetailAction).mockReturnValue(new Promise(() => {}));

    render(<NotificationDetailView id="notification_1" />);

    expect(screen.getByText("Notification")).toBeInTheDocument();
  });

  it("shows an error state when the fetch fails", async () => {
    vi.mocked(getNotificationDetailAction).mockResolvedValue({ success: false, error: "This notification could not be found." });

    render(<NotificationDetailView id="notification_missing" />);

    expect(await screen.findByText("This notification could not be found.")).toBeInTheDocument();
  });

  it("renders a fully populated detail with metadata, routing, template, and timeline", async () => {
    const notification = makeNotification({ id: "notification_42", title: "Contract signed", body: "Casey's contract was signed." });
    const data = makeDetailData({
      notification,
      template: { id: "template_1", workspace_id: "ws_1", kind: "proposal_accepted", name: "Contract Signed", description: "Sent when a contract is signed.", category: "crm", defaultPriority: "high", defaultChannel: "in_app", titleTemplate: "{{client}} signed", bodyTemplate: "Body", version: 2, archived_at: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
      timeline: [{ id: "activity_1", workspace_id: "ws_1", owner_type: "notification", owner_id: "notification_42", type: "notification_dispatched", description: "Notification dispatched", actor: "system", timestamp: "2026-08-15T09:00:00.000Z" }],
    });
    vi.mocked(getNotificationDetailAction).mockResolvedValue({ success: true, data });

    render(<NotificationDetailView id="notification_42" />);

    expect(await screen.findByText("Contract signed")).toBeInTheDocument();
    expect(screen.getByText("Casey's contract was signed.")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("crm")).toBeInTheDocument();
    expect(screen.getByText("Contract Signed")).toBeInTheDocument();
    expect(screen.getByText("Notification dispatched")).toBeInTheDocument();
  });

  it("renders the no-template and empty-timeline branches", async () => {
    const data = makeDetailData({ template: null, timeline: [] });
    vi.mocked(getNotificationDetailAction).mockResolvedValue({ success: true, data });

    render(<NotificationDetailView id="notification_1" />);

    expect(await screen.findByText("No template is associated with this notification.")).toBeInTheDocument();
    expect(screen.getByText("No timeline events recorded yet for this notification.")).toBeInTheDocument();
  });
});
