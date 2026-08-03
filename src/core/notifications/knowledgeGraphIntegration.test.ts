import { describe, expect, it } from "vitest";
import { computeNotificationActivityForNode, generateNotificationActivitySummary } from "@/core/notifications/knowledgeGraphIntegration";
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
    related_owner_type: "contract",
    related_owner_id: "contract_1",
    kind: null,
    priority: "normal",
    pinned_at: null,
    archived_at: null,
    ...overrides,
  };
}

describe("computeNotificationActivityForNode", () => {
  it("counts only notifications whose related owner matches the given node", () => {
    const notifications = [makeNotification({ id: "n1" }), makeNotification({ id: "n2", related_owner_type: "invoice", related_owner_id: "invoice_1" })];
    const summary = computeNotificationActivityForNode({ nodeType: "contract", nodeId: "contract_1" }, notifications);
    expect(summary.totalNotifications).toBe(1);
  });

  it("counts unread, non-archived notifications as unread", () => {
    const notifications = [makeNotification({ id: "n1", read_at: null }), makeNotification({ id: "n2", read_at: "2026-01-02T00:00:00.000Z" })];
    const summary = computeNotificationActivityForNode({ nodeType: "contract", nodeId: "contract_1" }, notifications);
    expect(summary.totalNotifications).toBe(2);
    expect(summary.unreadNotifications).toBe(1);
  });
});

describe("generateNotificationActivitySummary", () => {
  it("discloses zero notifications honestly", () => {
    expect(generateNotificationActivitySummary({ node: { nodeType: "contract", nodeId: "contract_1" }, totalNotifications: 0, unreadNotifications: 0 })).toBe(
      "No notifications reference this record.",
    );
  });

  it("pluralizes and includes the unread count when present", () => {
    const summary = generateNotificationActivitySummary({ node: { nodeType: "contract", nodeId: "contract_1" }, totalNotifications: 3, unreadNotifications: 2 });
    expect(summary).toContain("3 notifications");
    expect(summary).toContain("2 unread");
  });

  it("uses singular phrasing for exactly one notification", () => {
    const summary = generateNotificationActivitySummary({ node: { nodeType: "contract", nodeId: "contract_1" }, totalNotifications: 1, unreadNotifications: 0 });
    expect(summary).toContain("1 notification references");
  });
});
