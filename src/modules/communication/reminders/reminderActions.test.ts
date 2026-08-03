import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { createReminderAction, completeReminderAction, dismissReminderAction, deleteReminderAction, snoozeReminderAction, notifyDueRemindersForCurrentMember } from "@/modules/communication/reminders/reminderActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetReminderStore, mockReminderRepository } from "@/lib/data/core/communication/reminderStore";
import { resetNotificationsStore, mockNotificationsRepository } from "@/lib/data/core/notifications/mockRepository";
import * as clockModule from "@/core/time/clock";

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
  resetReminderStore();
  resetNotificationsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("createReminderAction", () => {
  it("defaults assignedToMemberId to the current member when blank", async () => {
    const result = await createReminderAction({ assignedToMemberId: "", title: "Follow up", dueAt: "2026-07-20T00:00:00.000Z" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.assigned_to_member_id).toBe("member_1");
  });
});

describe("completeReminderAction", () => {
  it("reschedules a recurring reminder to its next occurrence instead of leaving it completed", async () => {
    const created = await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "Weekly check-in", dueAt: "2026-07-15T12:00:00.000Z", recurrence: "weekly" });
    if (!created.success) throw new Error("setup failed");

    await completeReminderAction(created.data.id);
    const [reloaded] = await mockReminderRepository.listRemindersForMember("ws_1", "member_1");
    expect(reloaded.status).toBe("pending");
    expect(reloaded.due_at).toBe("2026-07-22T12:00:00.000Z");
  });

  it("leaves a one-time reminder completed with no reschedule", async () => {
    const created = await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "One-off task", dueAt: "2026-07-15T12:00:00.000Z" });
    if (!created.success) throw new Error("setup failed");

    await completeReminderAction(created.data.id);
    const [reloaded] = await mockReminderRepository.listRemindersForMember("ws_1", "member_1");
    expect(reloaded.status).toBe("completed");
  });
});

describe("ownership checks (v2 Checkpoint 45 security fix)", () => {
  it("rejects another member's attempt to complete, dismiss, snooze, or delete a reminder that isn't theirs", async () => {
    const created = await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "Private task", dueAt: "2026-07-15T12:00:00.000Z" });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" } });

    expect((await completeReminderAction(created.data.id)).success).toBe(false);
    expect((await dismissReminderAction(created.data.id)).success).toBe(false);
    expect((await snoozeReminderAction(created.data.id, "2026-07-16T00:00:00.000Z")).success).toBe(false);
    expect((await deleteReminderAction(created.data.id)).success).toBe(false);
  });

  it("rejects a member from a different workspace entirely", async () => {
    const created = await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "Private task", dueAt: "2026-07-15T12:00:00.000Z" });
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, workspace: { id: "ws_other_tenant", name: "Other Workspace" } });

    expect((await completeReminderAction(created.data.id)).success).toBe(false);
  });
});

describe("notifyDueRemindersForCurrentMember", () => {
  it("creates exactly one reminder_due notification per due reminder, and never twice for the same due date", async () => {
    vi.spyOn(clockModule, "clockNow").mockReturnValue(new Date("2026-07-15T13:00:00.000Z"));
    await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "Overdue task", dueAt: "2026-07-15T12:00:00.000Z" });

    const firstRun = await notifyDueRemindersForCurrentMember();
    expect(firstRun).toBe(1);

    const secondRun = await notifyDueRemindersForCurrentMember();
    expect(secondRun).toBe(0);

    const notifications = await mockNotificationsRepository.getNotificationsForMember("ws_1", "member_1");
    expect(notifications.filter((n) => n.kind === "reminder_due")).toHaveLength(1);
  });

  it("never notifies for a reminder that isn't due yet", async () => {
    vi.spyOn(clockModule, "clockNow").mockReturnValue(new Date("2026-07-15T13:00:00.000Z"));
    await mockReminderRepository.createReminder("ws_1", "member_1", { assignedToMemberId: "member_1", title: "Future task", dueAt: "2026-08-01T00:00:00.000Z" });

    const count = await notifyDueRemindersForCurrentMember();
    expect(count).toBe(0);
  });
});
