import { describe, expect, it } from "vitest";
import { computeNotificationRouting } from "@/core/notifications/routingEngine";
import { NOTIFICATION_CHANNELS, type Notification } from "@/core/notifications/types";
import type { NotificationPreferences } from "@/types/communication";

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
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
    ...overrides,
  };
}

function makePreferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    workspace_id: "ws_1",
    member_id: "member_1",
    desktop_enabled: true,
    in_app_enabled: true,
    email_enabled: false,
    sms_enabled: false,
    push_enabled: false,
    quiet_hours: { enabled: false, startHour: 21, endHour: 8 },
    muted_categories: [],
    minimum_priority: "low",
    digest_frequency: "daily",
    ...overrides,
  };
}

describe("computeNotificationRouting", () => {
  it("derives category from the notification's kind via NOTIFICATION_KIND_META", () => {
    const decision = computeNotificationRouting(makeNotification({ kind: "invoice_paid" }));
    expect(decision.category).toBe("finance");
  });

  it("falls back to the communication category when kind is null", () => {
    const decision = computeNotificationRouting(makeNotification({ kind: null }));
    expect(decision.category).toBe("communication");
  });

  it("is visible by default with no preferences supplied", () => {
    const decision = computeNotificationRouting(makeNotification());
    expect(decision.visible).toBe(true);
    expect(decision.suppressedReason).toBeNull();
  });

  it("is invisible once archived, regardless of preferences", () => {
    const decision = computeNotificationRouting(makeNotification({ archived_at: "2026-01-02T00:00:00.000Z" }));
    expect(decision.visible).toBe(false);
    expect(decision.suppressedReason).toContain("archived");
  });

  it("suppresses a notification whose category is muted", () => {
    const decision = computeNotificationRouting(makeNotification({ kind: "invoice_paid" }), makePreferences({ muted_categories: ["finance"] }));
    expect(decision.visible).toBe(false);
    expect(decision.suppressedReason).toContain("finance");
  });

  it("suppresses a notification below the member's minimum priority", () => {
    const decision = computeNotificationRouting(makeNotification({ priority: "low" }), makePreferences({ minimum_priority: "high" }));
    expect(decision.visible).toBe(false);
  });

  it("never expires critical or high priority notifications", () => {
    expect(computeNotificationRouting(makeNotification({ priority: "critical" })).expiresAt).toBeNull();
    expect(computeNotificationRouting(makeNotification({ priority: "high" })).expiresAt).toBeNull();
  });

  it("gives low/normal priority notifications a 30-day advisory expiry", () => {
    const decision = computeNotificationRouting(makeNotification({ priority: "normal", created_at: "2026-01-01T00:00:00.000Z" }));
    expect(decision.expiresAt).toBe("2026-01-31T00:00:00.000Z");
  });

  it("reports delivery readiness for every notification channel, in_app always configured", () => {
    const decision = computeNotificationRouting(makeNotification());
    expect(decision.deliveryReadiness.map((r) => r.channel).sort()).toEqual([...NOTIFICATION_CHANNELS].sort());
    const inApp = decision.deliveryReadiness.find((r) => r.channel === "in_app");
    expect(inApp?.configured).toBe(true);
    const email = decision.deliveryReadiness.find((r) => r.channel === "email");
    expect(email?.configured).toBe(false);
    expect(email?.reason).toBeTruthy();
  });
});
