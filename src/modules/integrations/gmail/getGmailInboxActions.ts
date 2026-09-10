"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getOwnMailbox, getThreadForCaller, listMessagesForThreadForCaller, listThreadsForCaller } from "@/core/integrations/gmail/gmailMailboxManager";
import { sanitizeGmailHtml } from "@/core/integrations/gmail/gmailHtmlSanitizer";
import type { GmailEmailAddress } from "@/core/integrations/gmail/types";

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";

/**
 * GMAIL-07 — the read-only Inbox's own data loaders. Both derive
 * `workspaceId`/`memberId` from the authenticated server session only —
 * there is no parameter on either export a caller could use to name a
 * different workspace/member; every read still goes through
 * `gmailMailboxManager.ts`'s own ownership-scoped functions underneath,
 * so this is defense-in-depth, not the only boundary. Neither loader
 * calls the Gmail API — both read exclusively from what
 * `gmailSyncEngine.ts` has already persisted (GMAIL-07D). Neither
 * returns a token, a credential id, or any integration secret.
 *
 * `body_html` is sanitized here, server-side, before the DTO ever
 * reaches a Client Component — see `gmailHtmlSanitizer.ts`'s own doc
 * comment for why that's stronger than "sanitize at render time."
 * Tombstoned messages (`deleted_at is not null`, GMAIL-06) are filtered
 * out of every DTO this file returns — never surfaced by omission's own
 * absence, always by an explicit safe state (`allDeleted`) so the UI
 * never has to guess whether "no messages" means "empty" or "deleted".
 */

export interface GmailInboxThreadSummary {
  id: string;
  subject: string | null;
  snippet: string | null;
  latestMessageAt: string | null;
  messageCount: number;
  unreadCount: number;
}

export type GetMyGmailInboxResult =
  | { success: true; data: { status: "no_connection" } }
  | { success: true; data: { status: "not_synced" } }
  | { success: true; data: { status: "ready"; threads: GmailInboxThreadSummary[] } }
  | { success: false; error: string };

export async function getMyGmailInboxAction(): Promise<GetMyGmailInboxResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.email")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const caller = { workspaceId: session.workspace.id, memberId: session.user.id };
  const mailbox = await getOwnMailbox(caller);
  if (!mailbox) return { success: true, data: { status: "no_connection" } };
  if (mailbox.sync_status === "not_synced") return { success: true, data: { status: "not_synced" } };

  const threads = await listThreadsForCaller(mailbox.id, caller);
  return {
    success: true,
    data: {
      status: "ready",
      threads: threads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        snippet: thread.snippet,
        latestMessageAt: thread.latest_message_at,
        messageCount: thread.message_count,
        unreadCount: thread.unread_count,
      })),
    },
  };
}

export interface GmailInboxMessageView {
  id: string;
  fromAddress: GmailEmailAddress | null;
  toAddresses: GmailEmailAddress[];
  ccAddresses: GmailEmailAddress[];
  subject: string | null;
  internalDate: string | null;
  bodyText: string | null;
  /** Already sanitized (see `gmailHtmlSanitizer.ts`) — safe to render with `dangerouslySetInnerHTML` as-is; never the raw provider HTML. */
  sanitizedBodyHtml: string | null;
  hasAttachments: boolean;
}

export type GetMyGmailThreadResult =
  | { success: true; data: { status: "not_found" } }
  | { success: true; data: { status: "all_deleted" } }
  | { success: true; data: { status: "ready"; subject: string | null; messages: GmailInboxMessageView[] } }
  | { success: false; error: string };

export async function getMyGmailThreadAction(threadId: string): Promise<GetMyGmailThreadResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.email")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const caller = { workspaceId: session.workspace.id, memberId: session.user.id };
  const thread = await getThreadForCaller(threadId, caller);
  // Deliberately the same "not_found" outcome whether the thread genuinely
  // doesn't exist or simply isn't this caller's own — never distinguishing
  // the two, the same fail-closed precedent this domain already established
  // for pending OAuth state and every other ownership check.
  if (!thread) return { success: true, data: { status: "not_found" } };

  const allMessages = await listMessagesForThreadForCaller(threadId, caller);
  const activeMessages = allMessages.filter((message) => message.deleted_at === null);

  if (allMessages.length > 0 && activeMessages.length === 0) return { success: true, data: { status: "all_deleted" } };
  if (activeMessages.length === 0) return { success: true, data: { status: "not_found" } };

  return {
    success: true,
    data: {
      status: "ready",
      subject: thread.subject,
      messages: activeMessages.map((message) => ({
        id: message.id,
        fromAddress: message.from_address,
        toAddresses: message.to_addresses,
        ccAddresses: message.cc_addresses,
        subject: message.subject,
        internalDate: message.internal_date,
        bodyText: message.body_text,
        sanitizedBodyHtml: message.body_html ? sanitizeGmailHtml(message.body_html) : null,
        hasAttachments: message.has_attachments,
      })),
    },
  };
}
