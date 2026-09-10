"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { syncGmailMailbox } from "@/core/integrations/gmail/gmailSyncEngine";
import { getOwnMailbox } from "@/core/integrations/gmail/gmailMailboxManager";
import type { GmailSyncResult } from "@/core/integrations/gmail/gmailSyncEngine";

const GENERIC_ACCESS_ERROR = "That integration connection isn't available. You may not have access to it.";

export type SyncMyGmailMailboxResult = { success: true; data: Exclude<GmailSyncResult, { status: "error" }> } | { success: false; error: string };

/**
 * GMAIL-05P — the canonical manual "Sync now" action. `workspaceId`/
 * `memberId` are derived from the authenticated server session only —
 * never from a client-supplied argument, so a caller cannot direct this
 * at a mailbox that isn't their own by passing different ids (there are
 * no ids to pass at all). Returns only safe summary metadata: counts and
 * a timestamp, or a reconnect/no-connection/error signal — never a
 * token, never a message body, never the full thread/message payloads
 * `gmailSyncEngine.ts` just persisted.
 */
export async function syncMyGmailMailboxAction(): Promise<SyncMyGmailMailboxResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("integrations.connect")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const result = await syncGmailMailbox({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (result.status === "error") return { success: false, error: result.reason };
  return { success: true, data: result };
}

export interface GmailMailboxSummary {
  syncStatus: string;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncErrorCode: string | null;
}

export type GetOwnGmailMailboxSummaryResult = { success: true; data: GmailMailboxSummary | null } | { success: false; error: string };

/** The safe, summary-only mailbox status `GmailConnectPanel` shows as "Last synced" — never a token, never message content, never the full mailbox/thread/message rows. */
export async function getOwnGmailMailboxSummaryAction(): Promise<GetOwnGmailMailboxSummaryResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const mailbox = await getOwnMailbox({ workspaceId: session.workspace.id, memberId: session.user.id });
  if (!mailbox) return { success: true, data: null };
  return {
    success: true,
    data: { syncStatus: mailbox.sync_status, lastSyncedAt: mailbox.last_synced_at, lastSuccessfulSyncAt: mailbox.last_successful_sync_at, syncErrorCode: mailbox.sync_error_code },
  };
}
