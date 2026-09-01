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

describe("notification actions — ownership enforcement (Phase 09D)", () => {
  const otherWorkspaceMember: MemberSessionSnapshot = {
    ...session,
    workspace: { id: "ws_other", name: "Other Workspace" },
    membership: { id: "member_other", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  };

  it("a caller cannot read/pin/archive a notification belonging to a different workspace, even knowing its real id", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Private", body: "Body" });
    if (!created.success) throw new Error("setup failed");
    const id = created.data.id;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceMember);
    expect((await markNotificationReadAction(id)).success).toBe(false);
    expect((await pinNotificationAction(id)).success).toBe(false);
    expect((await archiveNotificationAction(id)).success).toBe(false);
    expect((await unpinNotificationAction(id)).success).toBe(false);
    expect((await undoArchiveNotificationAction(id)).success).toBe(false);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const stillUnread = await mockNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(stillUnread.find((n) => n.id === id)?.read_at).toBeNull();
  });

  it("a nonexistent id and a foreign-workspace id fail with the same error", async () => {
    const created = await mockNotificationsRepository.createInAppNotification("ws_1", { recipientMemberId: "member_1", title: "Private", body: "Body" });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherWorkspaceMember);
    const foreign = await markNotificationReadAction(created.data.id);
    const nonexistent = await markNotificationReadAction("notif_nonexistent");
    expect(foreign.success).toBe(false);
    expect(nonexistent.success).toBe(false);
    if (!foreign.success && !nonexistent.success) expect(foreign.error).toBe(nonexistent.error);
  });
});
