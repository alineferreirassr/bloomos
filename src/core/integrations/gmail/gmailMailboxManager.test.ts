import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { installProvider } from "@/core/integrations/integrationManager";
import { resetGmailMailboxStore } from "@/lib/data/core/integrations/gmail/mailboxStore";
import { resetGmailThreadStore } from "@/lib/data/core/integrations/gmail/threadStore";
import { resetGmailMessageStore } from "@/lib/data/core/integrations/gmail/messageStore";
import {
  getMailboxForCaller,
  getOwnMailbox,
  getThreadForCaller,
  listMessagesForThreadForCaller,
  listThreadsForCaller,
  markMessageDeleted,
  upsertMailbox,
  upsertMessage,
  upsertThread,
} from "@/core/integrations/gmail/gmailMailboxManager";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_1 = "user_1";
const MEMBER_2 = "user_2";

async function installGmailConnection(workspaceId: string, memberId: string): Promise<string> {
  const connection = await installProvider({ workspaceId, providerId: "gmail", installedBy: memberId, memberId });
  return connection.id;
}

beforeEach(() => {
  resetConnectionStore();
  resetGmailMailboxStore();
  resetGmailThreadStore();
  resetGmailMessageStore();
});

describe("upsertMailbox", () => {
  it("creates a mailbox bound to the caller's own gmail connection", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(mailbox.workspace_id).toBe(WORKSPACE_ID);
    expect(mailbox.member_id).toBe(MEMBER_1);
    expect(mailbox.integration_connection_id).toBe(connectionId);
    expect(mailbox.sync_status).toBe("not_synced");
  });

  it("supports a null email_address — GMAIL-03 never acquired identity scopes", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    expect(mailbox.email_address).toBeNull();
  });

  it("supports a null history_id, and preserves it once set on a later upsert that omits it", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const created = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    expect(created.history_id).toBeNull();

    const withCursor = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, historyId: "12345" });
    expect(withCursor.id).toBe(created.id);
    expect(withCursor.history_id).toBe("12345");

    const again = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    expect(again.history_id).toBe("12345");
  });

  it("is idempotent — a second upsert for the same connection updates rather than duplicating", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const first = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "syncing" });
    const second = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "synced" });

    expect(second.id).toBe(first.id);
    expect(second.sync_status).toBe("synced");
  });

  it("rejects (forged mailbox ownership) when the caller's workspaceId/memberId don't match the connection's own ownership", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    await expect(upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, integrationConnectionId: connectionId })).rejects.toThrow(/not owned by the caller/);
    await expect(upsertMailbox({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId })).rejects.toThrow();
  });

  it("rejects binding to a connection that isn't a gmail connection", async () => {
    const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar", installedBy: MEMBER_1 });
    await expect(upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connection.id })).rejects.toThrow(/not a Gmail connection/);
  });

  it("rejects an unknown connection id", async () => {
    await expect(upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: "connection_missing" })).rejects.toThrow(/No integration connection/);
  });
});

describe("getMailboxForCaller / getOwnMailbox — ownership isolation", () => {
  it("the owning member can read their own mailbox", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    const own = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(own?.id).toBe(mailbox.id);
  });

  it("denies a same-workspace, different member from reading the mailbox", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getMailboxForCaller(mailbox.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
    expect(await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
  });

  it("denies a cross-workspace caller from reading the mailbox", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getMailboxForCaller(mailbox.id, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).toBeNull();
  });
});

describe("upsertThread", () => {
  async function seedMailbox(): Promise<string> {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    return mailbox.id;
  }

  it("creates a thread bound to the caller's own mailbox, preserving the provider-native thread id separately from the internal id", async () => {
    const mailboxId = await seedMailbox();
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerThreadId: "thread_abc123", subject: "Re: Booking" });

    expect(thread.mailbox_id).toBe(mailboxId);
    expect(thread.provider_thread_id).toBe("thread_abc123");
    expect(thread.id).not.toBe("thread_abc123");
  });

  it("is unique per (mailbox, provider_thread_id) — a second upsert with the same provider id updates in place", async () => {
    const mailboxId = await seedMailbox();
    const first = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerThreadId: "thread_abc123", messageCount: 1 });
    const second = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerThreadId: "thread_abc123", messageCount: 2 });

    expect(second.id).toBe(first.id);
    expect(second.message_count).toBe(2);

    const threads = await listThreadsForCaller(mailboxId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(threads).toHaveLength(1);
  });

  it("rejects (forged thread ownership) a caller who doesn't own the mailbox", async () => {
    const mailboxId = await seedMailbox();
    await expect(upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, mailboxId, providerThreadId: "thread_abc123" })).rejects.toThrow(/not owned by the caller/);
  });

  it("denies listing another member's threads", async () => {
    const mailboxId = await seedMailbox();
    await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerThreadId: "thread_abc123" });
    await expect(listThreadsForCaller(mailboxId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).rejects.toThrow();
  });
});

describe("upsertMessage", () => {
  async function seedThread(): Promise<{ mailboxId: string; threadId: string }> {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, providerThreadId: "thread_abc123" });
    return { mailboxId: mailbox.id, threadId: thread.id };
  }

  it("creates a message bound to its own thread and mailbox, preserving the provider-native message id separately from the internal id", async () => {
    const { mailboxId, threadId } = await seedThread();
    const message = await upsertMessage({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      mailboxId,
      threadId,
      providerMessageId: "msg_xyz789",
      providerThreadId: "thread_abc123",
      subject: "Re: Booking",
      fromAddress: { name: "Jordan", email: "jordan@example.com" },
      toAddresses: [{ name: null, email: "ana@amorebloom.com" }],
    });

    expect(message.thread_id).toBe(threadId);
    expect(message.mailbox_id).toBe(mailboxId);
    expect(message.provider_message_id).toBe("msg_xyz789");
    expect(message.id).not.toBe("msg_xyz789");
    expect(message.from_address).toEqual({ name: "Jordan", email: "jordan@example.com" });
  });

  it("is unique per (mailbox, provider_message_id) — a second upsert with the same provider id updates in place", async () => {
    const { mailboxId, threadId } = await seedThread();
    const first = await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_xyz789", providerThreadId: "thread_abc123", isRead: false });
    const second = await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_xyz789", providerThreadId: "thread_abc123", isRead: true });

    expect(second.id).toBe(first.id);
    expect(second.is_read).toBe(true);
  });

  it("lists messages for a thread, scoped to the owning caller", async () => {
    const { mailboxId, threadId } = await seedThread();
    await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_1", providerThreadId: "thread_abc123", internalDate: "2026-01-01T00:00:00Z" });
    await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_2", providerThreadId: "thread_abc123", internalDate: "2026-01-02T00:00:00Z" });

    const messages = await listMessagesForThreadForCaller(threadId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(messages).toHaveLength(2);
  });

  it("returns an empty list, not an error, when a non-owning caller asks for messages on a thread they don't own", async () => {
    const { threadId } = await seedThread();
    const messages = await listMessagesForThreadForCaller(threadId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 });
    expect(messages).toEqual([]);
  });

  it("rejects (forged message ownership) a caller who doesn't own the mailbox", async () => {
    const { mailboxId, threadId } = await seedThread();
    await expect(
      upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, mailboxId, threadId, providerMessageId: "msg_xyz789", providerThreadId: "thread_abc123" }),
    ).rejects.toThrow(/not owned by the caller/);
  });

  it("rejects a message whose threadId belongs to a different mailbox than the one supplied", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailboxA = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const threadInA = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailboxA.id, providerThreadId: "thread_in_a" });

    const otherConnectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_2);
    const mailboxB = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, integrationConnectionId: otherConnectionId });

    // MEMBER_1 owns both mailboxA and threadInA, but supplies mailboxB's id as the target mailbox.
    await expect(
      upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailboxB.id, threadId: threadInA.id, providerMessageId: "msg_1", providerThreadId: "thread_in_a" }),
    ).rejects.toThrow();
  });

  it("defaults has_attachments/is_read/is_starred/is_draft/is_sent to false, and never persists attachment bytes — only the boolean signal", async () => {
    const { mailboxId, threadId } = await seedThread();
    const message = await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_1", providerThreadId: "thread_abc123" });

    expect(message.has_attachments).toBe(false);
    expect(message.is_read).toBe(false);
    expect(message.is_starred).toBe(false);
    expect(message.is_draft).toBe(false);
    expect(message.is_sent).toBe(false);
    expect(Object.keys(message)).not.toContain("attachment_bytes");
    expect(Object.keys(message)).not.toContain("attachments");
  });

  it("persists provider label ids as a plain array, with no label-mutation surface", async () => {
    const { mailboxId, threadId } = await seedThread();
    const message = await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId: "msg_1", providerThreadId: "thread_abc123", labelIds: ["INBOX", "UNREAD"] });
    expect(message.label_ids).toEqual(["INBOX", "UNREAD"]);
  });

  it("persists body_text/body_html when supplied, with no rendering anywhere in this module", async () => {
    const { mailboxId, threadId } = await seedThread();
    const message = await upsertMessage({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      mailboxId,
      threadId,
      providerMessageId: "msg_1",
      providerThreadId: "thread_abc123",
      bodyText: "Hi Ana, following up on the booking.",
      bodyHtml: "<p>Hi Ana, following up on the booking.</p>",
    });
    expect(message.body_text).toContain("following up");
    expect(message.body_html).toContain("<p>");
  });
});

describe("getThreadForCaller — cross-owner isolation", () => {
  it("denies a same-workspace, different member from reading a thread", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, providerThreadId: "thread_abc123" });

    expect(await getThreadForCaller(thread.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
  });

  it("denies a cross-workspace caller from reading a thread", async () => {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, providerThreadId: "thread_abc123" });

    expect(await getThreadForCaller(thread.id, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).toBeNull();
  });
});

describe("markMessageDeleted (GMAIL-06)", () => {
  async function seedMessage(): Promise<{ mailboxId: string; threadId: string; providerMessageId: string }> {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, providerThreadId: "thread_abc123" });
    await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, threadId: thread.id, providerMessageId: "msg_1", providerThreadId: "thread_abc123" });
    return { mailboxId: mailbox.id, threadId: thread.id, providerMessageId: "msg_1" };
  }

  it("tombstones a message by its own provider id, never hard-deleting the row", async () => {
    const { mailboxId, threadId, providerMessageId } = await seedMessage();
    const tombstoned = await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId });

    expect(tombstoned?.deleted_at).not.toBeNull();
    expect(tombstoned?.provider_message_id).toBe(providerMessageId);

    const stillPresent = await listMessagesForThreadForCaller(threadId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(stillPresent.find((m) => m.provider_message_id === providerMessageId)).toBeTruthy();
  });

  it("is idempotent — tombstoning an already-deleted message keeps the original deleted_at rather than overwriting it", async () => {
    const { mailboxId, providerMessageId } = await seedMessage();
    const first = await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId });

    expect(second?.deleted_at).toBe(first?.deleted_at);
  });

  it("handles a nonexistent provider message id safely — returns null, never throws", async () => {
    const { mailboxId } = await seedMessage();
    const result = await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_never_existed" });
    expect(result).toBeNull();
  });

  it("denies a same-workspace, different member from tombstoning a message that isn't theirs", async () => {
    const { mailboxId, providerMessageId } = await seedMessage();
    await expect(markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, mailboxId, providerMessageId })).rejects.toThrow(/not owned by the caller/);
  });

  it("denies a cross-workspace caller from tombstoning a message", async () => {
    const { mailboxId, providerMessageId } = await seedMessage();
    await expect(markMessageDeleted({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId })).rejects.toThrow();
  });

  it("upsertMessage clears an existing tombstone when the provider message legitimately exists again (resurrection)", async () => {
    const { mailboxId, threadId, providerMessageId } = await seedMessage();
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId });

    const resurrected = await upsertMessage({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId, providerMessageId, providerThreadId: "thread_abc123", subject: "Still here" });
    expect(resurrected.deleted_at).toBeNull();
  });
});
