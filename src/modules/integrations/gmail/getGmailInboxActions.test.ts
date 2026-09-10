import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

const mockGetProfile = vi.fn();
const mockListThreads = vi.fn();
const mockGetThread = vi.fn();
const mockListHistory = vi.fn();
vi.mock("@/core/integrations/providers/gmail/gmailProvider", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/providers/gmail/gmailProvider")>("@/core/integrations/providers/gmail/gmailProvider");
  return {
    ...actual,
    GmailProvider: vi.fn().mockImplementation(function GmailProviderMockImpl(this: Record<string, unknown>) {
      this.getProfile = mockGetProfile;
      this.listThreads = mockListThreads;
      this.getThread = mockGetThread;
      this.listHistory = mockListHistory;
    }),
  };
});

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential, applyConnectionEvent } from "@/core/integrations/integrationManager";
import { resetGmailMailboxStore } from "@/lib/data/core/integrations/gmail/mailboxStore";
import { resetGmailThreadStore } from "@/lib/data/core/integrations/gmail/threadStore";
import { resetGmailMessageStore } from "@/lib/data/core/integrations/gmail/messageStore";
import { markMessageDeleted, upsertMailbox, upsertMessage, upsertThread } from "@/core/integrations/gmail/gmailMailboxManager";
import { GMAIL_READONLY_SCOPE } from "@/core/integrations/gmail/gmailSyncEngine";
import { getMyGmailInboxAction, getMyGmailThreadAction } from "@/modules/integrations/gmail/getGmailInboxActions";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_ID = "user_1";
const OTHER_MEMBER_ID = "user_2";

function sessionFor(workspaceId: string, memberId: string): Extract<MemberSessionSnapshot, { kind: "active" }> {
  return {
    kind: "active",
    user: { id: memberId, email: `${memberId}@amorebloom.com` },
    profile: { full_name: "Test Member", avatar_url: null },
    workspace: { id: workspaceId, name: "Amoré Bloom" },
    membership: { id: `member_${memberId}`, role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions: ["integrations.email", "integrations.connect"],
    workspaceDisplayName: "Amoré Bloom",
  };
}

async function seedMailboxWithThread(workspaceId: string, memberId: string): Promise<{ mailboxId: string; threadId: string }> {
  const connection = await installProvider({ workspaceId, providerId: "gmail", installedBy: memberId, memberId });
  await applyConnectionEvent(connection.id, "connect_requested", memberId);
  const credential = await issueOAuthCredential({
    workspaceId,
    connectionId: connection.id,
    scopes: ["https://www.googleapis.com/auth/gmail.send", GMAIL_READONLY_SCOPE],
    createdBy: memberId,
    accessToken: "real-access-token",
    memberId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_succeeded", memberId);

  const mailbox = await upsertMailbox({ workspaceId, memberId, integrationConnectionId: connection.id, syncStatus: "synced", lastSyncedAt: "2026-01-01T00:00:00Z" });
  const thread = await upsertThread({ workspaceId, memberId, mailboxId: mailbox.id, providerThreadId: "thread_abc123", subject: "Booking", snippet: "Hi Ana" });
  return { mailboxId: mailbox.id, threadId: thread.id };
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetGmailMailboxStore();
  resetGmailThreadStore();
  resetGmailMessageStore();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getMyGmailInboxAction", () => {
  it("returns no_connection when the caller has no Gmail connection", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const result = await getMyGmailInboxAction();
    expect(result).toEqual({ success: true, data: { status: "no_connection" } });
  });

  it("returns not_synced when the mailbox exists but has never been synced", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "gmail", installedBy: MEMBER_ID, memberId: MEMBER_ID });
    await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, integrationConnectionId: connection.id });

    const result = await getMyGmailInboxAction();
    expect(result).toEqual({ success: true, data: { status: "not_synced" } });
  });

  it("returns the caller's own threads, newest first, once synced", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const { mailboxId } = await seedMailboxWithThread(WORKSPACE_ID, MEMBER_ID);
    await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, mailboxId, providerThreadId: "thread_older", latestMessageAt: "2026-01-01T00:00:00Z" });
    await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, mailboxId, providerThreadId: "thread_abc123", latestMessageAt: "2026-01-05T00:00:00Z" });

    const result = await getMyGmailInboxAction();
    expect(result.success).toBe(true);
    if (!result.success || result.data.status !== "ready") throw new Error("expected ready");
    expect(result.data.threads[0].latestMessageAt).toBe("2026-01-05T00:00:00Z");
  });

  it("denies a caller missing integrations.email", async () => {
    const session = sessionFor(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: [] });
    const result = await getMyGmailInboxAction();
    expect(result.success).toBe(false);
  });

  it("a same-workspace, different member sees no_connection — their own mailbox, never the other member's", async () => {
    await seedMailboxWithThread(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));

    const result = await getMyGmailInboxAction();
    expect(result).toEqual({ success: true, data: { status: "no_connection" } });
  });

  it("a cross-workspace caller sees no_connection", async () => {
    await seedMailboxWithThread(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(OTHER_WORKSPACE_ID, MEMBER_ID));

    const result = await getMyGmailInboxAction();
    expect(result).toEqual({ success: true, data: { status: "no_connection" } });
  });

  it("never calls the Gmail API — reads persisted data only", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedMailboxWithThread(WORKSPACE_ID, MEMBER_ID);

    await getMyGmailInboxAction();

    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(mockListThreads).not.toHaveBeenCalled();
    expect(mockGetThread).not.toHaveBeenCalled();
    expect(mockListHistory).not.toHaveBeenCalled();
  });

  it("never includes a token or credential id in the result", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedMailboxWithThread(WORKSPACE_ID, MEMBER_ID);

    const result = await getMyGmailInboxAction();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("real-access-token");
    expect(serialized).not.toMatch(/credential_id|access_token_ref|refresh_token_ref/);
  });
});

describe("getMyGmailThreadAction", () => {
  async function seedMessage(workspaceId: string, memberId: string, overrides: Partial<Parameters<typeof upsertMessage>[0]> = {}) {
    const { mailboxId, threadId } = await seedMailboxWithThread(workspaceId, memberId);
    const message = await upsertMessage({
      workspaceId,
      memberId,
      mailboxId,
      threadId,
      providerMessageId: "msg_1",
      providerThreadId: "thread_abc123",
      subject: "Booking",
      bodyText: "Hi Ana, plain text body.",
      bodyHtml: "<p>Hi Ana</p><script>alert(1)</script>",
      fromAddress: { name: "Jordan", email: "jordan@example.com" },
      ...overrides,
    });
    return { mailboxId, threadId, message };
  }

  it("returns not_found for an unknown thread id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const result = await getMyGmailThreadAction("thread_never_existed");
    expect(result).toEqual({ success: true, data: { status: "not_found" } });
  });

  it("returns not_found (never a distinguishing error) for a same-workspace, different member's thread", async () => {
    const { threadId } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));

    const result = await getMyGmailThreadAction(threadId);
    expect(result).toEqual({ success: true, data: { status: "not_found" } });
  });

  it("returns not_found for a cross-workspace caller", async () => {
    const { threadId } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(OTHER_WORKSPACE_ID, MEMBER_ID));

    const result = await getMyGmailThreadAction(threadId);
    expect(result).toEqual({ success: true, data: { status: "not_found" } });
  });

  it("returns the owning member's own messages, sanitizing body_html server-side", async () => {
    const { threadId } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));

    const result = await getMyGmailThreadAction(threadId);
    expect(result.success).toBe(true);
    if (!result.success || result.data.status !== "ready") throw new Error("expected ready");
    expect(result.data.messages).toHaveLength(1);
    expect(result.data.messages[0].bodyText).toBe("Hi Ana, plain text body.");
    expect(result.data.messages[0].sanitizedBodyHtml).toContain("<p>Hi Ana</p>");
    expect(result.data.messages[0].sanitizedBodyHtml).not.toContain("<script");
    expect(result.data.messages[0].sanitizedBodyHtml).not.toContain("alert(1)");
  });

  it("excludes tombstoned messages from the ready response", async () => {
    const { mailboxId, threadId, message } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, mailboxId, threadId, providerMessageId: "msg_2", providerThreadId: "thread_abc123", bodyText: "Second message" });
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, mailboxId, providerMessageId: message.provider_message_id });

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const result = await getMyGmailThreadAction(threadId);
    expect(result.success).toBe(true);
    if (!result.success || result.data.status !== "ready") throw new Error("expected ready");
    expect(result.data.messages).toHaveLength(1);
    expect(result.data.messages[0].bodyText).toBe("Second message");
  });

  it("returns all_deleted when every message in the thread is tombstoned — never leaking the stale body", async () => {
    const { mailboxId, threadId, message } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, mailboxId, providerMessageId: message.provider_message_id });

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const result = await getMyGmailThreadAction(threadId);
    expect(result).toEqual({ success: true, data: { status: "all_deleted" } });
  });

  it("never calls the Gmail API", async () => {
    const { threadId } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));

    await getMyGmailThreadAction(threadId);
    expect(mockGetProfile).not.toHaveBeenCalled();
    expect(mockGetThread).not.toHaveBeenCalled();
  });

  it("never includes a token, credential id, or unsanitized raw HTML in the result", async () => {
    const { threadId } = await seedMessage(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));

    const result = await getMyGmailThreadAction(threadId);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("real-access-token");
    expect(serialized).not.toMatch(/credential_id|access_token_ref|refresh_token_ref/);
    expect(serialized).not.toContain("<script");
  });
});
