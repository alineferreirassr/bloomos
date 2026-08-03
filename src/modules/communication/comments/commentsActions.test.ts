import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getWorkspaceMembers: vi.fn(),
}));

import { createCommentAction, updateCommentAction, deleteCommentAction } from "@/modules/communication/comments/commentsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceMembers } from "@/lib/data";
import { getCoreNotificationsService } from "@/core/notifications";
import { resetNotificationsStore } from "@/lib/data/core/notifications/mockRepository";
import { resetCommentsStore } from "@/lib/data/core/comments/mockRepository";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["communications.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const roster = [
  { id: "member_1", full_name: "Ana Ferreira" },
  { id: "member_2", full_name: "Marina Costa" },
];

beforeEach(() => {
  resetNotificationsStore();
  resetCommentsStore();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getWorkspaceMembers).mockResolvedValue(roster as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createCommentAction", () => {
  it("creates the comment and stores parsed mentions", async () => {
    const result = await createCommentAction("client", "client_1", "Loop in @Marina Costa on this.");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mentioned_member_ids).toEqual(["member_2"]);
      expect(result.data.author).toBe("Ana Ferreira");
    }
  });

  it("sends exactly one real comment_mention notification to the mentioned member, never the author", async () => {
    await createCommentAction("client", "client_1", "Loop in @Marina Costa on this.");

    const marinaNotifications = await getCoreNotificationsService().getNotificationsForMember("ws_1", "member_2");
    expect(marinaNotifications).toHaveLength(1);
    expect(marinaNotifications[0].kind).toBe("comment_mention");

    const anaNotifications = await getCoreNotificationsService().getNotificationsForMember("ws_1", "member_1");
    expect(anaNotifications).toHaveLength(0);
  });

  it("@Team notifies every other member, not the author", async () => {
    await createCommentAction("client", "client_1", "@Team heads up.");

    const marinaNotifications = await getCoreNotificationsService().getNotificationsForMember("ws_1", "member_2");
    expect(marinaNotifications).toHaveLength(1);
    const anaNotifications = await getCoreNotificationsService().getNotificationsForMember("ws_1", "member_1");
    expect(anaNotifications).toHaveLength(0);
  });

  it("a comment with no mentions sends no notifications", async () => {
    await createCommentAction("client", "client_1", "Just a plain comment.");
    const marinaNotifications = await getCoreNotificationsService().getNotificationsForMember("ws_1", "member_2");
    expect(marinaNotifications).toHaveLength(0);
  });
});

describe("updateCommentAction / deleteCommentAction (v2 Checkpoint 45 security fix)", () => {
  it("rejects updating and deleting a comment from a different workspace", async () => {
    const created = await createCommentAction("client", "client_1", "Original text.");
    if (!created.success) throw new Error("setup failed");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, workspace: { id: "ws_other_tenant", name: "Other Workspace" } });

    const updateResult = await updateCommentAction(created.data.id, "Edited by an outsider");
    expect(updateResult.success).toBe(false);

    const deleteResult = await deleteCommentAction(created.data.id);
    expect(deleteResult.success).toBe(false);
  });

  it("allows updating a comment within the same workspace", async () => {
    const created = await createCommentAction("client", "client_1", "Original text.");
    if (!created.success) throw new Error("setup failed");

    const updateResult = await updateCommentAction(created.data.id, "Edited text.");
    expect(updateResult.success).toBe(true);
    if (updateResult.success) expect(updateResult.data.body).toBe("Edited text.");
  });
});
