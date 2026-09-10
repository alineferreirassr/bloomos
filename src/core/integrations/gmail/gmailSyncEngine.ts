import { nowIso } from "@/lib/data/utils";
import { getLogger } from "@/core/observability/logger";
import { listConnections } from "@/core/integrations/integrationManager";
import { getCredential, resolveAccessToken } from "@/core/integrations/credentialManager";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { GmailApiError, GmailProvider } from "@/core/integrations/providers/gmail/gmailProvider";
import { parseGmailMessage } from "@/core/integrations/providers/gmail/gmailMessageParser";
import { markMessageDeleted, upsertMailbox, upsertMessage, upsertThread } from "@/core/integrations/gmail/gmailMailboxManager";
import type { IntegrationConnection } from "@/core/integrations/types";
import type { GmailMailbox } from "@/core/integrations/gmail/types";

/**
 * GMAIL-05/GMAIL-06 — the Gmail Read + Sync Engine. Orchestrates a single
 * bounded "sync now" run for one member's own Gmail mailbox: resolve/
 * refresh the access token (reusing GMAIL-03's own refresh action — no
 * second refresh system), then either a bounded full listing
 * (`threads.list`/`threads.get`, GMAIL-05) or a true incremental
 * `history.list` walk (GMAIL-06), and persists through
 * `gmailMailboxManager.ts` (the same ownership-validated layer everything
 * else in this domain goes through).
 *
 * No Inbox UI, no attachment bytes, no label mutation. This file makes
 * real Gmail API calls — every other consumer of this domain (tests, the
 * manager) never has to.
 */

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/** Conservative, explicit, server-side bounds for a full/bounded listing — never an unbounded mailbox ingest. */
export const GMAIL_SYNC_PAGE_SIZE = 25;
export const GMAIL_SYNC_MAX_THREADS = 50;
/** A hard safety ceiling independent of GMAIL_SYNC_MAX_THREADS/PAGE_SIZE accounting — guarantees the list loop terminates even if a page ever reports an unexpectedly small result count. */
export const GMAIL_SYNC_MAX_PAGES = 10;

/** GMAIL-06 — bounds for the incremental `history.list` walk. Deliberately separate constants from the full-listing bounds above: a history page counts *events*, not threads, so the same numbers wouldn't mean the same thing. */
export const GMAIL_HISTORY_PAGE_SIZE = 100;
export const GMAIL_HISTORY_MAX_PAGES = 10;
/** Once this many distinct messages have been affected across the pages fetched so far, stop requesting further pages this run — the pages already fetched are still processed in full (never partially), and the next "sync now" resumes exactly where this one's own cursor advancement leaves off. */
export const GMAIL_HISTORY_MAX_AFFECTED_MESSAGES = 200;

/** A token is refreshed proactively once it's within this margin of its own recorded expiry, rather than waiting for Gmail to actually reject it. */
const TOKEN_EXPIRY_REFRESH_MARGIN_MS = 2 * 60 * 1000;

export type GmailSyncMode = "initial" | "incremental" | "full_resync";

export type GmailSyncResult =
  | { status: "success"; syncMode: GmailSyncMode; threadsProcessed: number; messagesProcessed: number; messagesDeleted: number; threadsSkipped: number; messagesSkipped: number; syncedAt: string }
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

/** 401/403/429/5xx are top-level, abort-the-whole-sync failures (surfaced to and classified by the caller) — never treated as "skip this one item and continue" the way an unparseable payload or a persistence error is. */
function isFatalGmailApiError(error: unknown): error is GmailApiError {
  return error instanceof GmailApiError && (error.status === 401 || error.status === 403 || error.status === 429 || error.status >= 500);
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

/**
 * Fetches one thread's full, current representation and upserts it (and
 * every message in it) through `gmailMailboxManager.ts` — the one place
 * both the full-listing path and the incremental-history path reuse
 * `gmailMessageParser.ts`/`upsertThread`/`upsertMessage`, per GMAIL-06J's
 * own "do not duplicate MIME parsing" instruction. A thread-level failure
 * (the `getThread`/`upsertThread` calls) propagates to the caller — fatal
 * Gmail errors abort the whole sync there; anything else is that
 * caller's own "skip this one thread" decision. A per-message persistence
 * failure is caught here and counted as `messagesSkipped`, matching this
 * file's pre-GMAIL-06 behavior exactly.
 */
async function fetchAndUpsertThread(gmail: GmailProvider, caller: GmailSyncCaller, mailbox: GmailMailbox, providerThreadId: string): Promise<{ messagesUpserted: number; messagesSkipped: number }> {
  const rawThread = await gmail.getThread(providerThreadId);
  const parsedMessages = (rawThread.messages ?? []).map(parseGmailMessage);
  if (parsedMessages.length === 0) return { messagesUpserted: 0, messagesSkipped: 0 };

  const latestMessageAt = parsedMessages.reduce<string | null>((latest, message) => {
    if (!message.internalDate) return latest;
    if (!latest || message.internalDate > latest) return message.internalDate;
    return latest;
  }, null);
  const unreadCount = parsedMessages.filter((message) => !message.isRead).length;

  const thread = await upsertThread({
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

  let messagesUpserted = 0;
  let messagesSkipped = 0;
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
      messagesUpserted++;
    } catch (error) {
      messagesSkipped++;
      getLogger().warn("Gmail sync: skipped one message that could not be persisted", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return { messagesUpserted, messagesSkipped };
}

interface BoundedListCounts {
  threadsProcessed: number;
  messagesProcessed: number;
  threadsSkipped: number;
  messagesSkipped: number;
}

/** GMAIL-05's original bounded full listing — reused for both a mailbox's first-ever sync (no `history_id` yet) and a `full_resync` recovery from an invalid/expired history cursor (GMAIL-06O). Never tombstones anything: a message simply absent from this listing is not evidence of deletion (only an explicit `history.list` `messagesDeleted` event is, per GMAIL-06D's own deferral of thread/message reconciliation-by-absence). */
async function runBoundedFullSync(gmail: GmailProvider, caller: GmailSyncCaller, mailbox: GmailMailbox): Promise<BoundedListCounts> {
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
    try {
      const result = await fetchAndUpsertThread(gmail, caller, mailbox, providerThreadId);
      messagesSkipped += result.messagesSkipped;
      if (result.messagesUpserted === 0) {
        threadsSkipped++;
        continue;
      }
      threadsProcessed++;
      messagesProcessed += result.messagesUpserted;
    } catch (error) {
      if (isFatalGmailApiError(error)) throw error;
      threadsSkipped++;
      getLogger().warn("Gmail sync: skipped one thread that could not be fetched/persisted", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  return { threadsProcessed, messagesProcessed, threadsSkipped, messagesSkipped };
}

type HistorySyncOutcome =
  | ({ kind: "success"; newHistoryId: string; messagesDeleted: number } & BoundedListCounts)
  | { kind: "invalid_cursor" };

/**
 * GMAIL-06 — the true incremental sync: walks `history.list` from the
 * mailbox's own persisted `history_id`, collapses every event into one
 * final action per provider message id (last event wins — Gmail returns
 * history records in chronological order, so overlapping
 * `messagesAdded`/`labelsAdded`/`labelsRemoved` for the same id become a
 * single canonical refresh, and a later `messagesDeleted` correctly
 * overrides an earlier add within the same batch), then applies it:
 * "upsert" actions refetch their own thread in full (deduplicated by
 * thread, since one `threads.get` call covers every affected message in
 * it) via `fetchAndUpsertThread`; "delete" actions tombstone directly by
 * provider message id via `markMessageDeleted` — never a message fetch,
 * never an attachment call, per GMAIL-06K.
 *
 * `newHistoryId` is the last *fully consumed* history page's own record
 * id, not the mailbox's absolute-latest available history — if
 * `GMAIL_HISTORY_MAX_AFFECTED_MESSAGES` stops this run from requesting
 * further pages, the cursor still only advances to what was actually
 * fetched and applied, so the next "sync now" resumes exactly where this
 * one left off rather than skipping unprocessed history.
 */
async function runIncrementalSync(gmail: GmailProvider, caller: GmailSyncCaller, mailbox: GmailMailbox, startHistoryId: string): Promise<HistorySyncOutcome> {
  const finalState = new Map<string, { action: "upsert" | "delete"; threadId: string }>();
  let pageToken: string | undefined;
  let pagesFetched = 0;
  let lastConsumedHistoryId = startHistoryId;

  try {
    do {
      const page = await gmail.listHistory({ startHistoryId, pageToken, maxResults: GMAIL_HISTORY_PAGE_SIZE });
      pagesFetched++;
      const records = page.history ?? [];
      for (const record of records) {
        for (const entry of record.messagesAdded ?? []) finalState.set(entry.message.id, { action: "upsert", threadId: entry.message.threadId });
        for (const entry of record.labelsAdded ?? []) finalState.set(entry.message.id, { action: "upsert", threadId: entry.message.threadId });
        for (const entry of record.labelsRemoved ?? []) finalState.set(entry.message.id, { action: "upsert", threadId: entry.message.threadId });
        for (const entry of record.messagesDeleted ?? []) finalState.set(entry.message.id, { action: "delete", threadId: entry.message.threadId });
      }
      if (records.length > 0) lastConsumedHistoryId = records[records.length - 1].id;
      else if (page.historyId) lastConsumedHistoryId = page.historyId;
      pageToken = page.nextPageToken;
    } while (pageToken && pagesFetched < GMAIL_HISTORY_MAX_PAGES && finalState.size < GMAIL_HISTORY_MAX_AFFECTED_MESSAGES);
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 404) return { kind: "invalid_cursor" };
    throw error;
  }

  const affectedThreadIds = new Set<string>();
  for (const info of finalState.values()) if (info.action === "upsert") affectedThreadIds.add(info.threadId);

  let threadsProcessed = 0;
  let messagesProcessed = 0;
  let threadsSkipped = 0;
  let messagesSkipped = 0;

  for (const providerThreadId of affectedThreadIds) {
    try {
      const result = await fetchAndUpsertThread(gmail, caller, mailbox, providerThreadId);
      messagesSkipped += result.messagesSkipped;
      if (result.messagesUpserted === 0) {
        threadsSkipped++;
        continue;
      }
      threadsProcessed++;
      messagesProcessed += result.messagesUpserted;
    } catch (error) {
      if (isFatalGmailApiError(error)) throw error;
      threadsSkipped++;
      getLogger().warn("Gmail sync: skipped one changed thread that could not be fetched/persisted", { mailboxId: mailbox.id, providerThreadId, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  let messagesDeleted = 0;
  for (const [providerMessageId, info] of finalState) {
    if (info.action !== "delete") continue;
    try {
      // markMessageDeleted returns null (not counted) for a provider message id
      // with no local row — a real, safe no-op, not a failure.
      const tombstoned = await markMessageDeleted({ workspaceId: caller.workspaceId, memberId: caller.memberId, mailboxId: mailbox.id, providerMessageId });
      if (tombstoned) messagesDeleted++;
    } catch (error) {
      messagesSkipped++;
      getLogger().warn("Gmail sync: skipped one deletion that could not be persisted", { mailboxId: mailbox.id, providerMessageId, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  return { kind: "success", newHistoryId: lastConsumedHistoryId, threadsProcessed, messagesProcessed, messagesDeleted, threadsSkipped, messagesSkipped };
}

/**
 * Runs one bounded "sync now" for the caller's own Gmail mailbox. Never
 * accepts a connection/mailbox id from an untrusted caller —
 * `workspaceId`/`memberId` must already come from an authenticated
 * server session (see `syncGmailMailboxAction`), and the only connection
 * ever touched is the one this exact member owns in this exact
 * workspace.
 *
 * Mode selection (GMAIL-06P): no persisted `history_id` yet → bounded
 * full sync ("initial"); a valid `history_id` → incremental history sync
 * ("incremental"); an invalid/expired cursor discovered mid-attempt →
 * falls back to a bounded full sync automatically ("full_resync"). The
 * persisted `history_id` only ever advances after its own batch is fully
 * applied — never on a caught, top-level failure (see the `catch` below,
 * which never touches `historyId`).
 */
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

    let syncMode: GmailSyncMode;
    let counts: BoundedListCounts;
    let messagesDeleted = 0;
    let newHistoryId: string;

    if (!mailbox.history_id) {
      syncMode = "initial";
      counts = await runBoundedFullSync(gmail, caller, mailbox);
      newHistoryId = profile.historyId;
    } else {
      const outcome = await runIncrementalSync(gmail, caller, mailbox, mailbox.history_id);
      if (outcome.kind === "invalid_cursor") {
        syncMode = "full_resync";
        counts = await runBoundedFullSync(gmail, caller, mailbox);
        newHistoryId = profile.historyId;
      } else {
        syncMode = "incremental";
        counts = outcome;
        messagesDeleted = outcome.messagesDeleted;
        newHistoryId = outcome.newHistoryId;
      }
    }

    const syncedAt = nowIso();
    await upsertMailbox({
      workspaceId: caller.workspaceId,
      memberId: caller.memberId,
      integrationConnectionId: connection.id,
      historyId: newHistoryId,
      syncStatus: "synced",
      lastSyncedAt: syncedAt,
      lastSuccessfulSyncAt: syncedAt,
      syncErrorCode: null,
    });

    return {
      status: "success",
      syncMode,
      threadsProcessed: counts.threadsProcessed,
      messagesProcessed: counts.messagesProcessed,
      messagesDeleted,
      threadsSkipped: counts.threadsSkipped,
      messagesSkipped: counts.messagesSkipped,
      syncedAt,
    };
  } catch (error) {
    const { code, reconnectRequired } = classifyGmailApiError(error);
    getLogger().error("Gmail sync failed", { connectionId: connection.id, mailboxId: mailbox.id, code });
    await markMailboxError(caller, connection.id, code);
    if (reconnectRequired) return { status: "reconnect_required", reason: code };
    return { status: "error", reason: code };
  }
}
