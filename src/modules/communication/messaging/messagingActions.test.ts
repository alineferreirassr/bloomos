import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import {
  getThreadMessagesAction,
  sendMessageAction,
  markThreadReadAction,
  setThreadPinnedAction,
  setThreadArchivedAction,
  startDirectThreadAction,
} from "@/modules/communication/messaging/messagingActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetMessageThreadStore, mockMessageThreadRepository } from "@/lib/data/core/communication/messageThreadStore";
import { resetNotificationsStore } from "@/lib/data/core/notifications/mockRepository";

const memberOne: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["communications.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const memberTwo: MemberSessionSnapshot = {
  ...memberOne,
  membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const outsiderSameWorkspace: MemberSessionSnapshot = {
  ...memberOne,
  membership: { id: "member_outsider", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const crossTenantMember: MemberSessionSnapshot = {
  ...memberOne,
  workspace: { id: "ws_2", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

function asSession(session: MemberSessionSnapshot): void {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
}

beforeEach(() => {
  resetMessageThreadStore();
  resetNotificationsStore();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function makeDirectThread(): Promise<string> {
  asSession(memberOne);
  const created = await startDirectThreadAction("member_2");
  if (!created.success) throw new Error("setup failed");
  return created.data.id;
}

describe("getThreadMessagesAction (v2 Checkpoint 45 security fix)", () => {
  it("lets a real participant read their own thread's messages", async () => {
    const threadId = await makeDirectThread();
    asSession(memberOne);
    await sendMessageAction(threadId, "Hello there");

    asSession(memberTwo);
    const result = await getThreadMessagesAction(threadId);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });

  it("rejects a same-workspace member who is not a participant of the thread", async () => {
    const threadId = await makeDirectThread();
    asSession(outsiderSameWorkspace);
    const result = await getThreadMessagesAction(threadId);
    expect(result.success).toBe(false);
  });

  it("rejects a member of a different workspace, even one who somehow knows the thread id", async () => {
    const threadId = await makeDirectThread();
    asSession(crossTenantMember);
    const result = await getThreadMessagesAction(threadId);
    expect(result.success).toBe(false);
  });

  it("rejects a nonexistent thread id", async () => {
    asSession(memberOne);
    const result = await getThreadMessagesAction("thread_nonexistent");
    expect(result.success).toBe(false);
  });
});

describe("sendMessageAction (v2 Checkpoint 45 security fix)", () => {
  it("lets a real participant send a message", async () => {
    const threadId = await makeDirectThread();
    asSession(memberOne);
    const result = await sendMessageAction(threadId, "Hi!");
    expect(result.success).toBe(true);
  });

  it("rejects a non-participant from injecting a message into someone else's thread", async () => {
    const threadId = await makeDirectThread();
    asSession(outsiderSameWorkspace);
    const result = await sendMessageAction(threadId, "I shouldn't be able to send this");
    expect(result.success).toBe(false);

    const messages = await mockMessageThreadRepository.listMessages(threadId);
    expect(messages).toHaveLength(0);
  });

  it("rejects a cross-tenant member from injecting a message", async () => {
    const threadId = await makeDirectThread();
    asSession(crossTenantMember);
    const result = await sendMessageAction(threadId, "cross-tenant injection attempt");
    expect(result.success).toBe(false);
  });
});

describe("markThreadReadAction / setThreadPinnedAction / setThreadArchivedAction (v2 Checkpoint 45 security fix)", () => {
  it("rejects a non-participant from marking another workspace member's thread read", async () => {
    const threadId = await makeDirectThread();
    asSession(outsiderSameWorkspace);
    const result = await markThreadReadAction(threadId);
    expect(result.success).toBe(false);
  });

  it("rejects a non-participant from pinning someone else's thread", async () => {
    const threadId = await makeDirectThread();
    asSession(outsiderSameWorkspace);
    const result = await setThreadPinnedAction(threadId, true);
    expect(result.success).toBe(false);
  });

  it("rejects a non-participant from archiving someone else's thread", async () => {
    const threadId = await makeDirectThread();
    asSession(outsiderSameWorkspace);
    const result = await setThreadArchivedAction(threadId, true);
    expect(result.success).toBe(false);
  });

  it("lets a real participant pin their own thread", async () => {
    const threadId = await makeDirectThread();
    asSession(memberOne);
    const result = await setThreadPinnedAction(threadId, true);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pinned_by_member_ids).toContain("member_1");
  });
});
