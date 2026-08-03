import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  pinNotificationAction,
  unpinNotificationAction,
  archiveNotificationAction,
  undoArchiveNotificationAction,
} from "@/modules/communication/notifications/notificationActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetNotificationsStore, mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["communications.view"],
  workspaceDisplayName: "Amoré Bloom",
};

beforeEach(() => {
  resetNotificationsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("notification actions", () => {
  it("pins, unpins, archives, and undoes an archive on a real notification", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Test", body: "Body" });
    if (!created.success) throw new Error("setup failed");
    const id = created.data.id;

    const pinned = await pinNotificationAction(id);
    expect(pinned.success && pinned.data.pinned_at).not.toBeNull();

    const unpinned = await unpinNotificationAction(id);
    expect(unpinned.success && unpinned.data.pinned_at).toBeNull();

    const archived = await archiveNotificationAction(id);
    expect(archived.success && archived.data.archived_at).not.toBeNull();

    const restored = await undoArchiveNotificationAction(id);
    expect(restored.success && restored.data.archived_at).toBeNull();
  });

  it("marks a single notification and then all remaining notifications read", async () => {
    await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "One", body: "" });
    const second = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Two", body: "" });
    if (!second.success) throw new Error("setup failed");

    await markNotificationReadAction(second.data.id);
    const afterFirstMark = await mockNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(afterFirstMark.filter((n) => n.read_at === null)).toHaveLength(1);

    const count = await markAllNotificationsReadAction();
    expect(count.success && count.data).toBe(1);

    const afterAll = await mockNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(afterAll.every((n) => n.read_at !== null)).toBe(true);
  });
});
