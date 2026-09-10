import { nowIso } from "@/lib/data/utils";
import { getConnection } from "@/core/integrations/integrationManager";
import {
  generateGmailMailboxId,
  getMailboxByConnectionId,
  getMailboxById,
  insertMailbox,
  listMailboxesForWorkspace,
  updateMailbox,
} from "@/lib/data/core/integrations/gmail/mailboxStore";
import {
  generateGmailThreadId,
  getThreadById,
  getThreadByProviderId,
  insertThread,
  listThreadsForMailbox,
  updateThread,
} from "@/lib/data/core/integrations/gmail/threadStore";
import {
  generateGmailMessageId,
  getMessageByProviderId,
  insertMessage,
  listMessagesForThread,
  updateMessage,
} from "@/lib/data/core/integrations/gmail/messageStore";
import type { GmailMailbox, GmailMessage, GmailThread, UpsertGmailMailboxParams, UpsertGmailMessageParams, UpsertGmailThreadParams } from "@/core/integrations/gmail/types";

/**
 * The Gmail Mailbox Manager (GMAIL-04) — the one orchestration layer
 * every future caller (a sync engine, an eventual Inbox UI's Server
 * Actions) goes through, mirroring `integrationManager.ts`'s own role
 * for the shared connection/credential substrate. No call site reaches
 * into `mailboxStore.ts`/`threadStore.ts`/`messageStore.ts` directly.
 *
 * Ownership enforcement lives entirely here, not in the stores: every
 * write validates the caller's own `workspaceId`/`memberId` against the
 * actual owning row (the connection for a mailbox, the mailbox for a
 * thread, the mailbox+thread for a message) — the same "store never
 * enforces ownership, the manager above it does" split this codebase
 * already established, and the same defense-in-depth the migration's own
 * RLS policies provide at the database level (see that migration's own
 * header comment for why a plain FK alone can't express "this connection
 * is really a gmail connection owned by this exact workspace/member").
 *
 * This file performs NO Gmail API calls and NO synchronization — it is
 * pure persistence orchestration for whatever a future sync engine
 * produces.
 */
export interface GmailCallerScope {
  workspaceId: string;
  memberId: string;
}

function isOwnedByCaller(row: { workspace_id: string; member_id: string }, caller: GmailCallerScope): boolean {
  return row.workspace_id === caller.workspaceId && row.member_id === caller.memberId;
}

/** The DB-level FK on `gmail_mailboxes.integration_connection_id` can't itself enforce "this is really a gmail connection owned by this exact workspace/member" (see the migration's own header comment) — this is that check, done here instead. */
async function assertGmailConnectionOwnership(integrationConnectionId: string, caller: GmailCallerScope): Promise<void> {
  const connection = await getConnection(integrationConnectionId);
  if (!connection) throw new Error("No integration connection found for this mailbox.");
  if (connection.provider_id !== "gmail") throw new Error("This connection is not a Gmail connection.");
  if (connection.workspace_id !== caller.workspaceId) throw new Error("This connection does not belong to the caller's workspace.");
  if (connection.member_id !== caller.memberId) throw new Error("This connection is not owned by the caller.");
}

async function assertMailboxOwnership(mailboxId: string, caller: GmailCallerScope): Promise<GmailMailbox> {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) throw new Error("No mailbox found.");
  if (!isOwnedByCaller(mailbox, caller)) throw new Error("This mailbox is not owned by the caller.");
  return mailbox;
}

async function assertThreadOwnership(threadId: string, mailboxId: string, caller: GmailCallerScope): Promise<GmailThread> {
  const thread = await getThreadById(threadId);
  if (!thread) throw new Error("No thread found.");
  if (!isOwnedByCaller(thread, caller)) throw new Error("This thread is not owned by the caller.");
  if (thread.mailbox_id !== mailboxId) throw new Error("This thread does not belong to the given mailbox.");
  return thread;
}

/** Insert-or-update by the mailbox's own `integration_connection_id` — idempotent, so a future sync engine can call this freely without tracking "have I created this mailbox row yet" itself. */
export async function upsertMailbox(params: UpsertGmailMailboxParams): Promise<GmailMailbox> {
  const caller: GmailCallerScope = { workspaceId: params.workspaceId, memberId: params.memberId };
  await assertGmailConnectionOwnership(params.integrationConnectionId, caller);

  const existing = await getMailboxByConnectionId(params.integrationConnectionId);
  if (existing) {
    if (!isOwnedByCaller(existing, caller)) throw new Error("This mailbox is not owned by the caller.");
    const updated = await updateMailbox(existing.id, {
      provider_account_id: params.providerAccountId ?? existing.provider_account_id,
      email_address: params.emailAddress ?? existing.email_address,
      display_name: params.displayName ?? existing.display_name,
      history_id: params.historyId ?? existing.history_id,
      sync_status: params.syncStatus ?? existing.sync_status,
      last_synced_at: params.lastSyncedAt ?? existing.last_synced_at,
      last_successful_sync_at: params.lastSuccessfulSyncAt ?? existing.last_successful_sync_at,
      sync_error_code: params.syncErrorCode ?? existing.sync_error_code,
    });
    if (!updated) throw new Error("Could not update this mailbox.");
    return updated;
  }

  const now = nowIso();
  const mailbox: GmailMailbox = {
    id: generateGmailMailboxId(),
    workspace_id: params.workspaceId,
    member_id: params.memberId,
    integration_connection_id: params.integrationConnectionId,
    provider_account_id: params.providerAccountId ?? null,
    email_address: params.emailAddress ?? null,
    display_name: params.displayName ?? null,
    history_id: params.historyId ?? null,
    sync_status: params.syncStatus ?? "not_synced",
    last_synced_at: params.lastSyncedAt ?? null,
    last_successful_sync_at: params.lastSuccessfulSyncAt ?? null,
    sync_error_code: params.syncErrorCode ?? null,
    created_at: now,
    updated_at: now,
  };
  return insertMailbox(mailbox);
}

export async function getMailboxForCaller(mailboxId: string, caller: GmailCallerScope): Promise<GmailMailbox | null> {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox || !isOwnedByCaller(mailbox, caller)) return null;
  return mailbox;
}

/** The caller's own mailbox in their own workspace — at most one per member, since `gmail_mailboxes` is unique per `integration_connection_id` and GMAIL-03's own connection model is one Gmail connection per member. */
export async function getOwnMailbox(caller: GmailCallerScope): Promise<GmailMailbox | null> {
  const mailboxes = await listMailboxesForWorkspace(caller.workspaceId);
  return mailboxes.find((mailbox) => mailbox.member_id === caller.memberId) ?? null;
}

/** Insert-or-update by `(mailboxId, providerThreadId)` — safe to call repeatedly for the same Gmail thread. */
export async function upsertThread(params: UpsertGmailThreadParams): Promise<GmailThread> {
  const caller: GmailCallerScope = { workspaceId: params.workspaceId, memberId: params.memberId };
  await assertMailboxOwnership(params.mailboxId, caller);

  const existing = await getThreadByProviderId(params.mailboxId, params.providerThreadId);
  if (existing) {
    const updated = await updateThread(existing.id, {
      subject: params.subject ?? existing.subject,
      snippet: params.snippet ?? existing.snippet,
      latest_message_at: params.latestMessageAt ?? existing.latest_message_at,
      message_count: params.messageCount ?? existing.message_count,
      unread_count: params.unreadCount ?? existing.unread_count,
    });
    if (!updated) throw new Error("Could not update this thread.");
    return updated;
  }

  const now = nowIso();
  const thread: GmailThread = {
    id: generateGmailThreadId(),
    workspace_id: params.workspaceId,
    member_id: params.memberId,
    mailbox_id: params.mailboxId,
    provider_thread_id: params.providerThreadId,
    subject: params.subject ?? null,
    snippet: params.snippet ?? null,
    latest_message_at: params.latestMessageAt ?? null,
    message_count: params.messageCount ?? 0,
    unread_count: params.unreadCount ?? 0,
    created_at: now,
    updated_at: now,
  };
  return insertThread(thread);
}

export async function getThreadForCaller(threadId: string, caller: GmailCallerScope): Promise<GmailThread | null> {
  const thread = await getThreadById(threadId);
  if (!thread || !isOwnedByCaller(thread, caller)) return null;
  return thread;
}

export async function listThreadsForCaller(mailboxId: string, caller: GmailCallerScope): Promise<GmailThread[]> {
  await assertMailboxOwnership(mailboxId, caller);
  return listThreadsForMailbox(mailboxId);
}

/** Insert-or-update by `(mailboxId, providerMessageId)` — safe to call repeatedly for the same Gmail message. */
export async function upsertMessage(params: UpsertGmailMessageParams): Promise<GmailMessage> {
  const caller: GmailCallerScope = { workspaceId: params.workspaceId, memberId: params.memberId };
  await assertMailboxOwnership(params.mailboxId, caller);
  await assertThreadOwnership(params.threadId, params.mailboxId, caller);

  const existing = await getMessageByProviderId(params.mailboxId, params.providerMessageId);
  if (existing) {
    const updated = await updateMessage(existing.id, {
      subject: params.subject ?? existing.subject,
      snippet: params.snippet ?? existing.snippet,
      body_text: params.bodyText ?? existing.body_text,
      body_html: params.bodyHtml ?? existing.body_html,
      label_ids: params.labelIds ?? existing.label_ids,
      is_read: params.isRead ?? existing.is_read,
      is_starred: params.isStarred ?? existing.is_starred,
      is_draft: params.isDraft ?? existing.is_draft,
      is_sent: params.isSent ?? existing.is_sent,
      has_attachments: params.hasAttachments ?? existing.has_attachments,
    });
    if (!updated) throw new Error("Could not update this message.");
    return updated;
  }

  const now = nowIso();
  const message: GmailMessage = {
    id: generateGmailMessageId(),
    workspace_id: params.workspaceId,
    member_id: params.memberId,
    mailbox_id: params.mailboxId,
    thread_id: params.threadId,
    provider_message_id: params.providerMessageId,
    provider_thread_id: params.providerThreadId,
    internal_date: params.internalDate ?? null,
    subject: params.subject ?? null,
    snippet: params.snippet ?? null,
    body_text: params.bodyText ?? null,
    body_html: params.bodyHtml ?? null,
    from_address: params.fromAddress ?? null,
    to_addresses: params.toAddresses ?? [],
    cc_addresses: params.ccAddresses ?? [],
    bcc_addresses: params.bccAddresses ?? [],
    reply_to_addresses: params.replyToAddresses ?? [],
    message_id_header: params.messageIdHeader ?? null,
    in_reply_to: params.inReplyTo ?? null,
    references_header: params.referencesHeader ?? null,
    label_ids: params.labelIds ?? [],
    is_read: params.isRead ?? false,
    is_starred: params.isStarred ?? false,
    is_draft: params.isDraft ?? false,
    is_sent: params.isSent ?? false,
    has_attachments: params.hasAttachments ?? false,
    created_at: now,
    updated_at: now,
  };
  return insertMessage(message);
}

export async function listMessagesForThreadForCaller(threadId: string, caller: GmailCallerScope): Promise<GmailMessage[]> {
  const thread = await getThreadForCaller(threadId, caller);
  if (!thread) return [];
  return listMessagesForThread(threadId);
}
