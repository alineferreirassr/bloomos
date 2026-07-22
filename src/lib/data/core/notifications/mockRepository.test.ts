import { describe, expect, it, beforeEach } from "vitest";
import { mockNotificationsRepository, resetNotificationsStore } from "@/lib/data/core/notifications/mockRepository";

const WORKSPACE_A = "ws_a";

beforeEach(() => {
  resetNotificationsStore();
});

describe("mockNotificationsRepository", () => {
  it("creates an in-app notification and lists it back for its recipient", async () => {
    const result = await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "Invoice overdue",
      body: "Invoice #204 is 3 days overdue.",
    });
    expect(result.success).toBe(true);

    const notifications = await mockNotificationsRepository.getNotificationsForMember(WORKSPACE_A, "member_1");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].channel).toBe("in_app");
    expect(notifications[0].read_at).toBeNull();
  });

  it("rejects a blank title", async () => {
    const result = await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "  ",
      body: "Body",
    });
    expect(result.success).toBe(false);
  });

  it("links a notification to a related owner via relatedOwnerType/relatedOwnerId", async () => {
    const result = await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "Contract signed",
      body: "Contract signed by the client.",
      relatedOwnerType: "contract",
      relatedOwnerId: "contract_1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.related_owner_type).toBe("contract");
      expect(result.data.related_owner_id).toBe("contract_1");
    }
  });

  it("marks a notification as read, setting read_at", async () => {
    const created = await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "Test",
      body: "Test body",
    });
    if (!created.success) throw new Error("setup failed");

    const marked = await mockNotificationsRepository.markNotificationRead(created.data.id);
    expect(marked.success).toBe(true);
    if (marked.success) {
      expect(marked.data.read_at).not.toBeNull();
    }
  });

  it("marking an already-read notification read again is a harmless no-op", async () => {
    const created = await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "Test",
      body: "Test body",
    });
    if (!created.success) throw new Error("setup failed");

    const first = await mockNotificationsRepository.markNotificationRead(created.data.id);
    const second = await mockNotificationsRepository.markNotificationRead(created.data.id);
    expect(first.success && second.success && first.data.read_at === second.data.read_at).toBe(true);
  });

  it("isolates notifications by recipient", async () => {
    await mockNotificationsRepository.createInAppNotification(WORKSPACE_A, {
      recipientMemberId: "member_1",
      title: "For member 1",
      body: "Body",
    });
    const forMember2 = await mockNotificationsRepository.getNotificationsForMember(WORKSPACE_A, "member_2");
    expect(forMember2).toEqual([]);
  });
});
