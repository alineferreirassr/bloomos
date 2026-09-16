import { afterEach, describe, expect, it } from "vitest";
import { mockNotificationsRepository, resetNotificationsStore } from "@/lib/data/core/notifications/mockRepository";

afterEach(() => {
  resetNotificationsStore();
});

describe("mockNotificationsRepository — create", () => {
  it("creates an in-app notification with the given fields, defaulting kind to null and priority to normal", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Lead Created", body: "A new lead arrived." });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ workspace_id: "ws_1", recipient_member_id: "member_1", channel: "in_app", title: "Lead Created", kind: null, priority: "normal", read_at: null, pinned_at: null, archived_at: null });
  });

  it("preserves an explicit kind/priority/related owner verbatim — metadata preservation", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Lead Created", body: "...", kind: "lead_created", priority: "high", relatedOwnerType: "lead", relatedOwnerId: "lead_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.kind).toBe("lead_created");
    expect(result.data.priority).toBe("high");
    expect(result.data.related_owner_type).toBe("lead");
    expect(result.data.related_owner_id).toBe("lead_1");
  });

  it("rejects a blank title", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "   ", body: "x" });
    expect(result.success).toBe(false);
  });

  it("rejects a notification with neither recipient set", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { title: "Hello", body: "World" });
    expect(result.success).toBe(false);
  });

  it("creates a client-account-recipient notification", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_1", title: "Welcome to your Client Portal", body: "..." });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.recipient_client_account_id).toBe("client_account_1");
    expect(result.data.recipient_member_id).toBeNull();
  });
});

describe("mockNotificationsRepository — list/query", () => {
  it("getNotificationsForMember returns only that member's own notifications, excluding another member's own", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "First", body: "..." });
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_2", title: "Other member", body: "..." });
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Second", body: "..." });

    const results = await mockNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(results.map((n) => n.title).sort()).toEqual(["First", "Second"]);
  });

  it("getNotificationsForClientAccount returns only that client account's own notifications", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_1", title: "For client 1", body: "..." });
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_2", title: "For client 2", body: "..." });

    const results = await mockNotificationsRepository.getNotificationsForClientAccount("ws_1", "client_account_1");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("For client 1");
  });

  it("getMemberNotificationsForWorkspace never includes client-account rows", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Member notification", body: "..." });
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_1", title: "Client notification", body: "..." });

    const results = await mockNotificationsRepository.getMemberNotificationsForWorkspace("ws_1");
    expect(results.map((n) => n.title)).toEqual(["Member notification"]);
  });

  it("getClientPortalNotificationsForWorkspace never includes member rows", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Member notification", body: "..." });
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientClientAccountId: "client_account_1", title: "Client notification", body: "..." });

    const results = await mockNotificationsRepository.getClientPortalNotificationsForWorkspace("ws_1");
    expect(results.map((n) => n.title)).toEqual(["Client notification"]);
  });
});

describe("mockNotificationsRepository — workspace isolation", () => {
  it("a notification created for ws_1 never appears in ws_2's own reads, for every list method", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "ws_1 only", body: "..." });

    expect(await mockNotificationsRepository.getNotificationsForMember("ws_2", "member_1")).toHaveLength(0);
    expect(await mockNotificationsRepository.getMemberNotificationsForWorkspace("ws_2")).toHaveLength(0);
  });

  it("markAllNotificationsRead only touches the given workspace + member, never a same-id member in a different workspace", async () => {
    const a = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "ws_1", body: "..." });
    const b = await mockNotificationsRepository.createInAppNotification("ws_2", { recipientMemberId: "member_1", title: "ws_2", body: "..." });
    expect(a.success && b.success).toBe(true);

    const result = await mockNotificationsRepository.markAllNotificationsRead("ws_1", "member_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toBe(1);

    const ws2Notifications = await mockNotificationsRepository.getNotificationsForMember("ws_2", "member_1");
    expect(ws2Notifications[0].read_at).toBeNull();
  });
});

describe("mockNotificationsRepository — unread/read state", () => {
  it("a new notification starts unread (read_at null)", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "New", body: "..." });
    expect(result.success && result.data.read_at).toBeNull();
  });

  it("markNotificationRead sets read_at; markNotificationUnread clears it back to null", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "New", body: "..." });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const read = await mockNotificationsRepository.markNotificationRead(created.data.id);
    expect(read.success).toBe(true);
    if (!read.success) return;
    expect(read.data.read_at).not.toBeNull();

    const unread = await mockNotificationsRepository.markNotificationUnread(created.data.id);
    expect(unread.success).toBe(true);
    if (!unread.success) return;
    expect(unread.data.read_at).toBeNull();
  });

  it("markNotificationRead is idempotent — no error, same read_at, if already read", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "New", body: "..." });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const first = await mockNotificationsRepository.markNotificationRead(created.data.id);
    const second = await mockNotificationsRepository.markNotificationRead(created.data.id);
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.read_at).toBe(first.data.read_at);
  });

  it("markNotificationRead fails for an unknown id", async () => {
    const result = await mockNotificationsRepository.markNotificationRead("does-not-exist");
    expect(result.success).toBe(false);
  });

  it("marking an already-unread notification unread again is a harmless no-op", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Test body" });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await mockNotificationsRepository.markNotificationUnread(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.read_at).toBeNull();
  });
});

describe("mockNotificationsRepository — pin/archive", () => {
  it("pin/unpin round-trips pinned_at", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "New", body: "..." });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const pinned = await mockNotificationsRepository.pinNotification(created.data.id);
    expect(pinned.success && pinned.data.pinned_at).not.toBeNull();

    const unpinned = await mockNotificationsRepository.unpinNotification(created.data.id);
    expect(unpinned.success && unpinned.data.pinned_at).toBeNull();
  });

  it("archive/unarchive round-trips archived_at", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "New", body: "..." });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const archived = await mockNotificationsRepository.archiveNotification(created.data.id);
    expect(archived.success && archived.data.archived_at).not.toBeNull();

    const unarchived = await mockNotificationsRepository.unarchiveNotification(created.data.id);
    expect(unarchived.success && unarchived.data.archived_at).toBeNull();
  });
});

describe("mockNotificationsRepository — existing notification kinds", () => {
  it("accepts every currently-declared NotificationKind value", async () => {
    const kinds = ["lead_created", "proposal_sent", "proposal_accepted", "invoice_created", "invoice_paid", "payment_failed", "event_upcoming", "inventory_low", "vendor_assigned", "workflow_finished", "automation_failed", "bloom_ai_insight", "reminder_due", "comment_mention", "approval_requested", "announcement_published", "message_received", "escalation"] as const;
    for (const kind of kinds) {
      const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: kind, body: "...", kind });
      expect(result.success && result.data.kind).toBe(kind);
    }
  });

  it("lead_created remains a valid, storable kind but is never itself created by this test — confirming only the kind vocabulary, not any Lead wiring", async () => {
    const result = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Manually constructed for this test only", body: "...", kind: "lead_created" });
    expect(result.success && result.data.kind).toBe("lead_created");
  });
});
