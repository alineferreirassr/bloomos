import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getWorkspaceMembers: vi.fn(),
}));

import { publishAnnouncementAction, acknowledgeAnnouncementAction, deleteAnnouncementAction } from "@/modules/communication/announcements/announcementActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceMembers } from "@/lib/data";
import { resetAnnouncementStore } from "@/lib/data/core/communication/announcementStore";
import { resetNotificationsStore } from "@/lib/data/core/notifications/mockRepository";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["communications.view", "communications.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const roster = [
  { id: "member_1", full_name: "Ana Ferreira" },
  { id: "member_2", full_name: "Marina Costa" },
];

beforeEach(() => {
  resetAnnouncementStore();
  resetNotificationsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getWorkspaceMembers).mockResolvedValue(roster as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function publishOne() {
  const result = await publishAnnouncementAction({ title: "Office closed Friday", body: "Enjoy the long weekend." });
  if (!result.success) throw new Error("setup failed");
  return result.data;
}

describe("acknowledgeAnnouncementAction / deleteAnnouncementAction (v2 Checkpoint 45 security fix)", () => {
  it("allows acknowledging and deleting within the same workspace", async () => {
    const announcement = await publishOne();
    const ackResult = await acknowledgeAnnouncementAction(announcement.id);
    expect(ackResult.success).toBe(true);

    const deleteResult = await deleteAnnouncementAction(announcement.id);
    expect(deleteResult.success).toBe(true);
  });

  it("rejects acknowledging and deleting an announcement from a different workspace", async () => {
    const announcement = await publishOne();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, workspace: { id: "ws_other_tenant", name: "Other Workspace" } });

    const ackResult = await acknowledgeAnnouncementAction(announcement.id);
    expect(ackResult.success).toBe(false);

    const deleteResult = await deleteAnnouncementAction(announcement.id);
    expect(deleteResult.success).toBe(false);
  });
});
