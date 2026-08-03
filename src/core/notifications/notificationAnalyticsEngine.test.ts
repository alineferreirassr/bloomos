import { describe, expect, it } from "vitest";
import { computeNotificationAnalytics } from "@/core/notifications/notificationAnalyticsEngine";
import type { Notification } from "@/core/notifications/types";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "notification_1",
    workspace_id: "ws_1",
    recipient_member_id: "member_1",
    recipient_client_account_id: null,
    channel: "in_app",
    title: "Test",
    body: "Test body",
    read_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    related_owner_type: null,
    related_owner_id: null,
    kind: "lead_created",
    priority: "normal",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

describe("computeNotificationAnalytics", () => {
  it("counts created/read/unread/archived/pinned correctly", () => {
    const notifications: Notification[] = [
      makeNotification({ id: "n1", read_at: "2026-01-01T01:00:00.000Z" }),
      makeNotification({ id: "n2", read_at: null }),
      makeNotification({ id: "n3", archived_at: "2026-01-01T02:00:00.000Z" }),
      makeNotification({ id: "n4", pinned_at: "2026-01-01T03:00:00.000Z" }),
    ];
    const analytics = computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z");
    expect(analytics.totalCreated).toBe(4);
    expect(analytics.totalRead).toBe(1);
    expect(analytics.totalUnread).toBe(2); // n2 (unread, active) and n4 (unread, pinned, active)
    expect(analytics.totalArchived).toBe(1);
    expect(analytics.totalDismissed).toBe(analytics.totalArchived);
    expect(analytics.totalPinned).toBe(1);
  });

  it("counts high and critical priority together as high priority", () => {
    const notifications = [makeNotification({ priority: "high" }), makeNotification({ priority: "critical" }), makeNotification({ priority: "low" })];
    expect(computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z").totalHighPriority).toBe(2);
  });

  it("computes average response time only from notifications that were actually read", () => {
    const notifications = [
      makeNotification({ created_at: "2026-01-01T00:00:00.000Z", read_at: "2026-01-01T00:01:00.000Z" }),
      makeNotification({ created_at: "2026-01-01T00:00:00.000Z", read_at: null }),
    ];
    const analytics = computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z");
    expect(analytics.averageResponseSeconds).toBe(60);
  });

  it("reports averageResponseSeconds as null, not fabricated, when nothing has been read yet", () => {
    const analytics = computeNotificationAnalytics([makeNotification({ read_at: null })], "2026-06-01T00:00:00.000Z");
    expect(analytics.averageResponseSeconds).toBeNull();
  });

  it("computes delivery readiness rate as the fraction of configured channels (in_app only, by default)", () => {
    const analytics = computeNotificationAnalytics([], "2026-06-01T00:00:00.000Z");
    expect(analytics.deliveryReadinessRate).toBeCloseTo(0.25);
  });

  it("computes engagement rate as read/total, 0 when there are no notifications", () => {
    expect(computeNotificationAnalytics([], "2026-06-01T00:00:00.000Z").engagementRate).toBe(0);
    const analytics = computeNotificationAnalytics([makeNotification({ read_at: "2026-01-01T01:00:00.000Z" }), makeNotification({ read_at: null })], "2026-06-01T00:00:00.000Z");
    expect(analytics.engagementRate).toBe(0.5);
  });

  it("reports trend as steady for a sample too small to call a direction", () => {
    const notifications = [makeNotification(), makeNotification(), makeNotification()];
    expect(computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z").trend).toBe("steady");
  });

  it("reports trend as improving when the more recent half reads notably more than the older half", () => {
    const notifications = [
      makeNotification({ created_at: "2026-01-01T00:00:00.000Z", read_at: null }),
      makeNotification({ created_at: "2026-01-02T00:00:00.000Z", read_at: null }),
      makeNotification({ created_at: "2026-01-03T00:00:00.000Z", read_at: "2026-01-03T01:00:00.000Z" }),
      makeNotification({ created_at: "2026-01-04T00:00:00.000Z", read_at: "2026-01-04T01:00:00.000Z" }),
    ];
    expect(computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z").trend).toBe("improving");
  });

  it("groups counts by category (derived from kind) and by kind", () => {
    const notifications = [makeNotification({ kind: "lead_created" }), makeNotification({ kind: "lead_created" }), makeNotification({ kind: "invoice_paid" })];
    const analytics = computeNotificationAnalytics(notifications, "2026-06-01T00:00:00.000Z");
    expect(analytics.byKind.lead_created).toBe(2);
    expect(analytics.byKind.invoice_paid).toBe(1);
    expect(analytics.byCategory.crm).toBe(2);
    expect(analytics.byCategory.finance).toBe(1);
  });
});
