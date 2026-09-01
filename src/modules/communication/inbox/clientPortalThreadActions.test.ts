import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getClientPortalThreadDetailAction } from "@/modules/communication/inbox/clientPortalThreadActions";
import { getUnifiedInboxData } from "@/modules/communication/inbox/getUnifiedInboxData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetClientPortalMessageStore, listClientPortalThreadsForWorkspace } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { resetClientAccountsStore } from "@/lib/data/mock/clientAccountsStore";
import { resetMessageThreadStore, mockMessageThreadRepository } from "@/lib/data/core/communication/messageThreadStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const founder: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["communications.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const staffMember: MemberSessionSnapshot = {
  ...founder,
  membership: { id: "member_2", role: "staff", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const crossTenantMember: MemberSessionSnapshot = {
  ...founder,
  workspace: { id: "ws_other", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

const unauthenticated: MemberSessionSnapshot = { kind: "unauthenticated" } as MemberSessionSnapshot;

function asSession(session: MemberSessionSnapshot): void {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
}

beforeEach(() => {
  resetClientPortalMessageStore();
  resetClientAccountsStore();
  resetMessageThreadStore();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function seededThreadId(): string {
  const [thread] = listClientPortalThreadsForWorkspace(CURRENT_WORKSPACE_ID);
  if (!thread) throw new Error("seed setup failed — no Client Portal thread found");
  return thread.id;
}

describe("getClientPortalThreadDetailAction (Phase 09C.2)", () => {
  it("A — a Founder/member in the correct workspace can load the thread and its messages", async () => {
    const threadId = seededThreadId();
    asSession(founder);
    const result = await getClientPortalThreadDetailAction(threadId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.thread.id).toBe(threadId);
      expect(result.data.messages.length).toBeGreaterThan(0);
    }
  });

  it("B — a staff member with communications.view can load the same-workspace thread", async () => {
    const threadId = seededThreadId();
    asSession(staffMember);
    const result = await getClientPortalThreadDetailAction(threadId);
    expect(result.success).toBe(true);
  });

  it("C — an unauthenticated caller is denied", async () => {
    const threadId = seededThreadId();
    asSession(unauthenticated);
    const result = await getClientPortalThreadDetailAction(threadId);
    expect(result.success).toBe(false);
  });

  it("D — a member of a different workspace is denied, even knowing the real thread id", async () => {
    const threadId = seededThreadId();
    asSession(crossTenantMember);
    const result = await getClientPortalThreadDetailAction(threadId);
    expect(result.success).toBe(false);
  });

  it("E — a nonexistent thread id fails safely, with the same error as a cross-workspace thread", async () => {
    asSession(founder);
    const nonexistent = await getClientPortalThreadDetailAction("thread_nonexistent");
    asSession(crossTenantMember);
    const foreign = await getClientPortalThreadDetailAction(seededThreadId());
    expect(nonexistent.success).toBe(false);
    expect(foreign.success).toBe(false);
    if (!nonexistent.success && !foreign.success) expect(nonexistent.error).toBe(foreign.error);
  });

  it("F — the caller cannot spoof a workspace id; the thread lookup is always scoped to the session's own workspace", async () => {
    const threadId = seededThreadId();
    // crossTenantMember has a genuinely different session.workspace.id — the action must derive
    // scoping from the session server-side, never from any argument the caller could control.
    asSession(crossTenantMember);
    const result = await getClientPortalThreadDetailAction(threadId);
    expect(result.success).toBe(false);
  });
});

describe("Unified Inbox href normalization (Phase 09C.2)", () => {
  it("G — a Client Portal message thread's href becomes /inbox/client-portal/{threadId}", async () => {
    asSession(founder);
    const result = await getUnifiedInboxData();
    expect(result.success).toBe(true);
    if (result.success) {
      const clientPortalItem = result.data.find((item) => item.source === "client_portal_message");
      expect(clientPortalItem).toBeDefined();
      expect(clientPortalItem?.href).toBe(`/inbox/client-portal/${clientPortalItem?.id}`);
    }
  });

  it("H — an internal message thread's href is unchanged", async () => {
    asSession(founder);
    const thread = await mockMessageThreadRepository.findOrCreateDirectThread(CURRENT_WORKSPACE_ID, "member_1", "member_2");
    const result = await getUnifiedInboxData();
    expect(result.success).toBe(true);
    if (result.success) {
      const internalItem = result.data.find((item) => item.source === "internal_message" && item.id === thread.id);
      expect(internalItem?.href).toBe(`/inbox/${thread.id}`);
    }
  });
});
