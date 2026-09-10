import { nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import { listConnections } from "@/core/integrations/integrationManager";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { GmailApiError, GmailProvider } from "@/core/integrations/providers/gmail/gmailProvider";
import { parseGmailMessage } from "@/core/integrations/providers/gmail/gmailMessageParser";
import { upsertMailbox, upsertMessage, upsertThread } from "@/core/integrations/gmail/gmailMailboxManager";
import type { IntegrationConnection } from "@/core/integrations/types";
import type { GmailMailbox } from "@/core/integrations/gmail/types";

/**
 * GMAIL-05 — the Gmail Read + Sync Engine. Orchestrates a single bounded
 * "sync now" run for one member's own Gmail mailbox: resolve/refresh the
 * access token (reusing GMAIL-03's own refresh action — no second refresh
 * system), fetch a bounded page of threads via the real Gmail API
 * (`GmailProvider`), parse each thread's messages (`gmailMessageParser.ts`),
 * and persist through `gmailMailboxManager.ts` (the same ownership-
 * validated layer everything else in this domain goes through).
 *
 * No Inbox UI, no incremental `history.list` sync (see this file's own
 * `INCREMENTAL_SYNC_DEFERRAL` doc below), no attachment bytes, no label
 * mutation. This file makes real Gmail API calls — every other Gmail-04
 * consumer (tests, the manager) never has to.
 */

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Conservative, explicit, server-side bounds — never an unbounded mailbox ingest. */
export const GMAIL_SYNC_PAGE_SIZE = 25;
export const GMAIL_SYNC_MAX_THREADS = 50;
/** A hard safety ceiling independent of GMAIL_SYNC_MAX_THREADS/PAGE_SIZE accounting — guarantees the list loop terminates even if a page ever reports an unexpectedly small result count. */
export const GMAIL_SYNC_MAX_PAGES = 10;

/** A token is refreshed proactively once it's within this margin of its own recorded expiry, rather than waiting for Gmail to actually reject it. */
const TOKEN_EXPIRY_REFRESH_MARGIN_MS = 2 * 60 * 1000;

/**
 * INCREMENTAL_SYNC_DEFERRAL — GMAIL-05L/M's own mechanical determination:
 * `gmail_mailboxes.history_id` is persisted (from `users.getProfile()`)
 * after every successful sync, so a future checkpoint has the cursor it
 * needs — but this checkpoint does NOT call `users.history.list` to
 * consume it. Reason: `history.list` routinely returns `messagesDeleted`
 * records for ordinary user actions (delete, permanently-empty-trash),
 * and GMAIL-04's schema has no deletion/tombstone representation at all
 * (no `deleted_at`, no soft-delete flag) — processing history without a
 * safe way to represent a deletion would mean silently dropping that
 * record type or fabricating schema mid-checkpoint, both explicitly
 * forbidden (GMAIL-05M's own HARD STOP condition). Instead, every sync
 * this checkpoint runs is a bounded "resync": re-list recent threads and
 * upsert them idempotently (safe to repeat, never duplicates — see
 * gmailMailboxManager.ts's own upsert-by-provider-id semantics) rather
 * than a true incremental history walk. Deletion/tombstone support and
 * real `history.list` processing are explicitly deferred to a future
 * checkpoint with its own schema decision.
 */
export const INCREMENTAL_SYNC_STATUS = "deferred_pending_deletion_schema" as const;

export type GmailSyncResult =
  | { status: "success"; threadsProcessed: number; messagesProcessed: number; threadsSkipped: number; messagesSkipped: number; syncedAt: string }
  | { status: "reconnect_required"; reason: string }
  | { status: "no_connection" }
  | { status: "error"; reason: string };

export interface GmailSyncCaller {
  workspaceId: string;
  memberId: string;
}

async function findOwnGmailConnection(caller: GmailSyncCaller): Promise<IntegrationConnection | null> {
  const connections = await listConnections(caller.workspaceId);
  return connections.find((connection) => connection.provider_id === "gmail" && connection.member_id === caller.memberId) ?? null;
}

/** Non-sensitive, machine-readable classification of a Gmail API failure — never the raw provider response body. */
function classifyGmailApiError(error: unknown): { code: string; reconnectRequired: boolean } {
  if (error instanceof GmailApiError) {
    if (error.status === 401) return { code: "gmail_unauthorized", reconnectRequired: true };
    if (error.status === 403) return { code: "gmail_forbidden", reconnectRequired: false };
    if (error.status === 429) return { code: "gmail_rate_limited", reconnectRequired: false };
    if (error.status >= 500) return { code: "gmail_provider_error", reconnectRequired: false };
    return { code: `gmail_api_error_${error.status}`, reconnectRequired: false };
  }
  return { code: "sync_failed", reconnectRequired: false };
}

/** Resolves a real, usable access token for this connection's credential — refreshing it first (reusing `refreshProviderOAuthConnectionAction`, GMAIL-03's own refresh system) when it's missing, already expired, or close enough to expiry to risk failing mid-sync. Returns null when no usable token could be obtained at all. */
async function ensureFreshAccessToken(connection: IntegrationConnection, credentialId: string): Promise<string | null> {
  const credential = await getCredential(credentialId);
  if (!credential) return null;

  const isExpiringSoon = credential.expires_at !== null && new Date(credential.expires_at).getTime() < Date.now() + TOKEN_EXPIRY_REFRESH_MARGIN_MS;
  const needsRefresh = connection.state === "expired" || isExpiringSoon;

  if (!needsRefresh) {
    const token = await resolveAccessToken(credentialId);
    if (token) return token;
  }

  const refreshed = await refreshProviderOAuthConnectionAction(connection.id);
  if (!refreshed.success || !refreshed.data.credential_id) return null;
  return resolveAccessToken(refreshed.data.credential_id);
}

async function markMailboxError(caller: GmailSyncCaller, connectionId: string, errorCode: string): Promise<void> {
  await upsertMailbox({
    workspaceId: caller.workspaceId,
    memberId: caller.memberId,
    integrationConnectionId: connectionId,
    syncStatus: "error",
    lastSyncedAt: nowIso(),
    syncErrorCode: errorCode,
  }).catch((error) => {
    getLogger().error("Gmail sync: could not record sync error on the mailbox row", { connectionId, error: error instanceof Error ? error.message : "unknown" });
  });
}

/** Runs one bounded "sync now" for the caller's own Gmail mailbox. Never accepts a connection/mailbox id from an untrusted caller — `workspaceId`/`memberId` must already come from an authenticated server session (see `syncGmailMailboxAction`), and the only connection ever touched is the one this exact member owns in this exact workspace. */
export async function syncGmailMailbox(caller: GmailSyncCaller): Promise<GmailSyncResult> {
  const connection = await findOwnGmailConnection(caller);
  if (!connection) return { status: "no_connection" };
  if (connection.workspace_id !== caller.workspaceId || connection.member_id !== caller.memberId) return { status: "no_connection" };

  if (!connection.credential_id) return { status: "reconnect_required", reason: "no_credential" };
  const credential = await getCredential(connection.credential_id);
  if (!credential || credential.kind !== "oauth_token") return { status: "reconnect_required", reason: "no_credential" };

  if (!credential.scopes.includes(GMAIL_READONLY_SCOPE)) {
    // A real, otherwise-healthy connection authorized before GMAIL-05 only
    // ever holds gmail.send — never assume gmail.readonly exists just
    // because a connection is "connected". See gmailSyncEngine's own
    // module doc for why this doesn't itself mutate connection state.
    return { status: "reconnect_required", reason: "missing_readonly_scope" };
  }

  if (connection.state !== "connected" && connection.state !== "expired") {
    return { status: "error", reason: `Gmail connection is currently "${connection.state}" — cannot sync.` };
  }

  const accessToken = await ensureFreshAccessToken(connection, credential.id);
  if (!accessToken) return { status: "reconnect_required", reason: "refresh_failed" };

  const gmail = new GmailProvider(accessToken);

  let mailbox: GmailMailbox;
  try {
    mailbox = await upsertMailbox({ workspaceId: caller.workspaceId, memberId: caller.memberId, integrationConnectionId: connection.id, syncStatus: "syncing" });
  } catch (error) {
    getLogger().error("Gmail sync: could not establish the mailbox row", { connectionId: connection.id, error: error instanceof Error ? error.message : "unknown" });
    return { status: "error", reason: "mailbox_upsert_failed" };
  }

  try {
    const profile = await gmail.getProfile();
    mailbox = await upsertMailbox({
      workspaceId: caller.workspaceId,
      memberId: caller.memberId,
      integrationConnectionId: connection.id,
      providerAccountId: profile.emailAddress,
      emailAddress: profile.emailAddress,
      syncStatus: "syncing",
    });

    const threadIds: string[] = [];
    let pageToken: string | undefined;
    let pagesFetched = 0;
    do {
      const page = await gmail.listThreads({ maxResults: GMAIL_SYNC_PAGE_SIZE, pageToken });
      pagesFetched++;
      for (const thread of page.threads ?? []) {
        if (threadIds.length >= GMAIL_SYNC_MAX_THREADS) break;
        threadIds.push(thread.id);
      }
      pageToken = page.nextPageToken;
    } while (pageToken && threadIds.length < GMAIL_SYNC_MAX_THREADS && pagesFetched < GMAIL_SYNC_MAX_PAGES);

    let threadsProcessed = 0;
    let messagesProcessed = 0;
    let threadsSkipped = 0;
    let messagesSkipped = 0;

    for (const providerThreadId of threadIds) {
      let rawThread;
      try {
        rawThread = await gmail.getThread(providerThreadId);
      } catch (error) {
        if (error instanceof GmailApiError && (error.status === 401 || error.status === 403 || error.status === 429 || error.status >= 500)) throw error;
        threadsSkipped++;
        getLogger().warn("Gmail sync: skipped one thread that could not be fetched", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
        continue;
      }

      const parsedMessages = (rawThread.messages ?? []).map(parseGmailMessage);
      if (parsedMessages.length === 0) {
        threadsSkipped++;
        continue;
      }

      const latestMessageAt = parsedMessages.reduce<string | null>((latest, message) => {
        if (!message.internalDate) return latest;
        if (!latest || message.internalDate > latest) return message.internalDate;
        return latest;
      }, null);
      const unreadCount = parsedMessages.filter((message) => !message.isRead).length;

      let thread;
      try {
        thread = await upsertThread({
          workspaceId: caller.workspaceId,
          memberId: caller.memberId,
          mailboxId: mailbox.id,
          providerThreadId,
          subject: parsedMessages[0]?.subject ?? null,
          snippet: parsedMessages[parsedMessages.length - 1]?.snippet ?? null,
          latestMessageAt,
          messageCount: parsedMessages.length,
          unreadCount,
        });
      } catch (error) {
        threadsSkipped++;
        getLogger().warn("Gmail sync: skipped one thread that could not be persisted", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
        continue;
      }
      threadsProcessed++;

      for (const parsed of parsedMessages) {
        try {
          await upsertMessage({
            workspaceId: caller.workspaceId,
            memberId: caller.memberId,
            mailboxId: mailbox.id,
            threadId: thread.id,
            providerMessageId: parsed.providerMessageId,
            providerThreadId: parsed.providerThreadId,
            internalDate: parsed.internalDate,
            subject: parsed.subject,
            snippet: parsed.snippet,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
            fromAddress: parsed.fromAddress,
            toAddresses: parsed.toAddresses,
            ccAddresses: parsed.ccAddresses,
            bccAddresses: parsed.bccAddresses,
            replyToAddresses: parsed.replyToAddresses,
            messageIdHeader: parsed.messageIdHeader,
            inReplyTo: parsed.inReplyTo,
            referencesHeader: parsed.referencesHeader,
            labelIds: parsed.labelIds,
            isRead: parsed.isRead,
            isStarred: parsed.isStarred,
            isDraft: parsed.isDraft,
            isSent: parsed.isSent,
            hasAttachments: parsed.hasAttachments,
          });
          messagesProcessed++;
        } catch (error) {
          messagesSkipped++;
          getLogger().warn("Gmail sync: skipped one message that could not be persisted", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
        }
      }
    }

    const syncedAt = nowIso();
    await upsertMailbox({
      workspaceId: caller.workspaceId,
      memberId: caller.memberId,
      integrationConnectionId: connection.id,
      historyId: profile.historyId,
      syncStatus: "synced",
      lastSyncedAt: syncedAt,
      lastSuccessfulSyncAt: syncedAt,
      syncErrorCode: null,
    });

    return { status: "success", threadsProcessed, messagesProcessed, threadsSkipped, messagesSkipped, syncedAt };
  } catch (error) {
    const { code, reconnectRequired } = classifyGmailApiError(error);
    getLogger().error("Gmail sync failed", { connectionId: connection.id, mailboxId: mailbox.id, code });
    await markMailboxError(caller, connection.id, code);
    if (reconnectRequired) return { status: "reconnect_required", reason: code };
    return { status: "error", reason: code };
  }
}
