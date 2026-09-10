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
  reconcileThreadMetadata,
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

describe("reconcileThreadMetadata (GMAIL-08)", () => {
  async function seedMailboxAndThread(): Promise<{ mailboxId: string; threadId: string }> {
    const connectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_1);
    const mailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const thread = await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: mailbox.id, providerThreadId: "thread_abc123" });
    return { mailboxId: mailbox.id, threadId: thread.id };
  }

  async function addMessage(
    mailboxId: string,
    threadId: string,
    providerMessageId: string,
    overrides: { internalDate?: string | null; isRead?: boolean; snippet?: string | null } = {},
  ) {
    return upsertMessage({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      mailboxId,
      threadId,
      providerMessageId,
      providerThreadId: "thread_abc123",
      internalDate: overrides.internalDate ?? "1735689600000",
      isRead: overrides.isRead ?? true,
      snippet: overrides.snippet ?? null,
    });
  }

  it("1. counts every active (non-tombstoned) message", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1");
    await addMessage(mailboxId, threadId, "msg_2");
    await addMessage(mailboxId, threadId, "msg_3");

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.message_count).toBe(3);
  });

  it("2. excludes a tombstoned message from the count", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1");
    await addMessage(mailboxId, threadId, "msg_2");
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.message_count).toBe(1);
  });

  it("3. replaying the same tombstone and reconciling twice does not double-decrement", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1");
    await addMessage(mailboxId, threadId, "msg_2");
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

    const first = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    // Replay: the same provider message id tombstoned again (idempotent no-op), reconciled again.
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });
    const second = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });

    expect(first.message_count).toBe(1);
    expect(second.message_count).toBe(1);
  });

  it("4. counts an active unread message", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { isRead: false });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.unread_count).toBe(1);
  });

  it("5. does not count an active read message as unread", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { isRead: true });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.unread_count).toBe(0);
  });

  it("6. excludes a tombstoned unread message from unread_count", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { isRead: false });
    await addMessage(mailboxId, threadId, "msg_2", { isRead: false });
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.unread_count).toBe(1);
  });

  it("7. a tombstoned read message does not affect unread_count either way", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { isRead: false });
    await addMessage(mailboxId, threadId, "msg_2", { isRead: true });
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.unread_count).toBe(1);
    expect(reconciled.message_count).toBe(1);
  });

  it("8. latest_message_at is the max internal_date among active messages", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000" }); // earlier
    await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000" }); // later

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.latest_message_at).toBe("1735776000000");
  });

  it("9. deleting a non-latest message leaves latest_message_at unchanged", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000" }); // earlier — will be deleted
    await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000" }); // later, stays
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_1" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.latest_message_at).toBe("1735776000000");
  });

  it("10 & 11. deleting the current-latest message falls back to the next-latest active message", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000" }); // earlier
    await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000" }); // latest — will be deleted
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.latest_message_at).toBe("1735689600000");
  });

  it("12, 13, 14, 15. deleting the final active message produces the canonical empty-thread state (0/0/null), thread row preserved", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000", isRead: false });
    await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_1" });

    const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
    expect(reconciled.message_count).toBe(0);
    expect(reconciled.unread_count).toBe(0);
    expect(reconciled.latest_message_at).toBeNull();
    // The thread row itself is never hard-deleted — still readable by the owning caller.
    const stillThere = await getThreadForCaller(threadId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(stillThere).not.toBeNull();
  });

  it("16. the owning member can reconcile their own thread", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await addMessage(mailboxId, threadId, "msg_1");
    await expect(reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId })).resolves.toBeTruthy();
  });

  it("17. denies a same-workspace, different member from reconciling a thread that isn't theirs", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await expect(reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, mailboxId, threadId })).rejects.toThrow(/not owned by the caller/);
  });

  it("18. denies a cross-workspace caller from reconciling a thread", async () => {
    const { mailboxId, threadId } = await seedMailboxAndThread();
    await expect(reconcileThreadMetadata({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId })).rejects.toThrow();
  });

  it("19. denies a thread id that belongs to a different mailbox than the one supplied", async () => {
    const { threadId } = await seedMailboxAndThread();
    const otherConnectionId = await installGmailConnection(WORKSPACE_ID, MEMBER_2);
    const otherMailbox = await upsertMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, integrationConnectionId: otherConnectionId });

    await expect(
      reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId: otherMailbox.id, threadId }),
    ).rejects.toThrow();
  });

  it("rejects an unknown thread id", async () => {
    const { mailboxId } = await seedMailboxAndThread();
    await expect(
      reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId: "gmail-thread_missing" }),
    ).rejects.toThrow(/No thread found/);
  });

  describe("snippet (GMAIL-09)", () => {
    it("1. with one active message, snippet is that message's own snippet", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { snippet: "Hi Ana, following up" });

      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      expect(reconciled.snippet).toBe("Hi Ana, following up");
    });

    it("2 & 3. with multiple active messages, snippet deterministically comes from the latest (max internal_date) one, not array order", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      // Inserted out of chronological order on purpose — the source must be date-driven, not insertion-order-driven.
      await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000", snippet: "Second, later message" });
      await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000", snippet: "First, earlier message" });

      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      expect(reconciled.snippet).toBe("Second, later message");
    });

    it("4 & 5. tombstoning the current snippet-source message falls back to the next-latest active message's own snippet", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000", snippet: "Earlier message" });
      await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000", snippet: "Latest message — will be deleted" });
      await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });

      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });
      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });

      expect(reconciled.snippet).toBe("Earlier message");
    });

    it("6. tombstoning a non-source (non-latest) message leaves the snippet unchanged", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000", snippet: "Earlier message — will be deleted" });
      await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000", snippet: "Latest message" });

      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_1" });
      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });

      expect(reconciled.snippet).toBe("Latest message");
    });

    it("7 & 8. tombstoning the final active message clears snippet to null, never a sentinel string", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { snippet: "Only message here" });
      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_1" });

      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      expect(reconciled.snippet).toBeNull();
      expect(reconciled.snippet).not.toBe("(deleted)");
      expect(reconciled.snippet).not.toBe("No messages");
      expect(reconciled.snippet).not.toBe("Message unavailable");
    });

    it("9. reconciling twice after the same tombstone is idempotent — snippet doesn't change on replay", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { internalDate: "1735689600000", snippet: "Earlier message" });
      await addMessage(mailboxId, threadId, "msg_2", { internalDate: "1735776000000", snippet: "Latest message" });
      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" });

      const first = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_2" }); // replay, idempotent no-op
      const second = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });

      expect(first.snippet).toBe("Earlier message");
      expect(second.snippet).toBe("Earlier message");
    });

    it("26. subject is never touched by reconciliation, regardless of which message is tombstoned", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await upsertThread({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerThreadId: "thread_abc123", subject: "Original Subject" });
      await addMessage(mailboxId, threadId, "msg_1", { snippet: "Body preview" });
      await markMessageDeleted({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, providerMessageId: "msg_1" });

      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      expect(reconciled.subject).toBe("Original Subject");
    });

    it("a message with no snippet at all still reconciles safely (null propagates, no crash)", async () => {
      const { mailboxId, threadId } = await seedMailboxAndThread();
      await addMessage(mailboxId, threadId, "msg_1", { snippet: null });

      const reconciled = await reconcileThreadMetadata({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, mailboxId, threadId });
      expect(reconciled.snippet).toBeNull();
      expect(reconciled.message_count).toBe(1);
    });
  });
});
