"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { listClientPortalThreadsForWorkspace, listClientPortalMessages } from "@/lib/data/clientPortal/clientPortalMessageStore";
import { readClientAccounts } from "@/lib/data/mock/clientAccountsStore";
import type { ClientPortalMessage, ClientPortalMessageThread } from "@/types/clientPortalMessage";
import type { DataResult } from "@/lib/data/result";

const GENERIC_ACCESS_ERROR = "This conversation isn't available. You may not have access to it.";

export interface ClientPortalThreadDetail {
  thread: ClientPortalMessageThread;
  messages: ClientPortalMessage[];
  /** The Client this thread belongs to, if resolvable from existing account data — null otherwise. Never fabricated. */
  clientId: string | null;
}

/**
 * Phase 09C.2 — the staff-side read boundary for a Client Portal message
 * thread, closing the Unified Inbox's routing contract for
 * `client_portal_message` items. Reuses the existing workspace-scoped
 * `listClientPortalThreadsForWorkspace` (never a caller-supplied
 * workspace id) to resolve `threadId` — a thread belonging to another
 * workspace is filtered out by that call before the `.find()` below ever
 * sees it, so a foreign thread and a nonexistent one both produce the
 * same generic "not available" result. Read-only: no reply/mutation is
 * exposed here (see docs — staff→client reply is a deferred capability).
 */
export async function getClientPortalThreadDetailAction(threadId: string): Promise<DataResult<ClientPortalThreadDetail>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const thread = listClientPortalThreadsForWorkspace(session.workspace.id).find((t) => t.id === threadId);
  if (!thread) return { success: false, error: GENERIC_ACCESS_ERROR };

  const messages = listClientPortalMessages(thread.id);
  const clientId = readClientAccounts().find((account) => account.id === thread.client_account_id)?.client_id ?? null;

  return { success: true, data: { thread, messages, clientId } };
}
