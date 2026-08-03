import { describe, expect, it } from "vitest";
import { buildNotificationTimelineEvent } from "@/core/notifications/notificationTimelineEngine";
import type { Notification } from "@/core/notifications/types";

const notification: Notification = {
  id: "notification_1",
  workspace_id: "ws_1",
  recipient_member_id: "member_1",
  recipient_client_account_id: null,
  channel: "in_app",
  title: "Invoice paid",
  body: "Invoice #204 was paid.",
  read_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  related_owner_type: null,
  related_owner_id: null,
  kind: "invoice_paid",
  priority: "high",
  pinned_at: null,
  archived_at: null,
};

describe("buildNotificationTimelineEvent", () => {
  it("owns every event on the notification's own EntityType, never the related entity", () => {
    for (const transition of ["dispatched", "read", "archived"] as const) {
      const event = buildNotificationTimelineEvent(notification, transition);
      expect(event.ownerType).toBe("notification");
      expect(event.ownerId).toBe(notification.id);
    }
  });

  it("maps each transition to its own distinct TimelineActivityType", () => {
    expect(buildNotificationTimelineEvent(notification, "dispatched").type).toBe("notification_dispatched");
    expect(buildNotificationTimelineEvent(notification, "read").type).toBe("notification_read");
    expect(buildNotificationTimelineEvent(notification, "archived").type).toBe("notification_archived");
  });

  it("includes the notification's own title in the description", () => {
    const event = buildNotificationTimelineEvent(notification, "read");
    expect(event.description).toContain("Invoice paid");
  });
});
