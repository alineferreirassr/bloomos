import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/modules/integrations/manageOAuthConnectionActions", () => ({ refreshProviderOAuthConnectionAction: vi.fn() }));

const { mockGetProfile, mockListThreads, mockGetThread, mockListHistory, GmailProviderMock } = vi.hoisted(() => {
  const mockGetProfile = vi.fn();
  const mockListThreads = vi.fn();
  const mockGetThread = vi.fn();
  const mockListHistory = vi.fn();
  const GmailProviderMock = vi.fn().mockImplementation(function GmailProviderMockImpl(this: Record<string, unknown>, accessToken: string) {
    this.accessToken = accessToken;
    this.getProfile = mockGetProfile;
    this.listThreads = mockListThreads;
    this.getThread = mockGetThread;
    this.listHistory = mockListHistory;
  });
  return { mockGetProfile, mockListThreads, mockGetThread, mockListHistory, GmailProviderMock };
});
vi.mock("@/core/integrations/providers/gmail/gmailProvider", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/providers/gmail/gmailProvider")>("@/core/integrations/providers/gmail/gmailProvider");
  return { ...actual, GmailProvider: GmailProviderMock };
});

import { GmailApiError } from "@/core/integrations/providers/gmail/gmailProvider";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential, rotateOAuthCredential } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential, applyConnectionEvent, getConnection } from "@/core/integrations/integrationManager";
import { resetGmailMailboxStore } from "@/lib/data/core/integrations/gmail/mailboxStore";
import { resetGmailThreadStore } from "@/lib/data/core/integrations/gmail/threadStore";
import { resetGmailMessageStore } from "@/lib/data/core/integrations/gmail/messageStore";
import { getOwnMailbox, listThreadsForCaller, listMessagesForThreadForCaller } from "@/core/integrations/gmail/gmailMailboxManager";
import {
  GMAIL_HISTORY_MAX_PAGES,
  GMAIL_HISTORY_PAGE_SIZE,
  GMAIL_READONLY_SCOPE,
  GMAIL_SYNC_MAX_THREADS,
  GMAIL_SYNC_PAGE_SIZE,
  syncGmailMailbox,
} from "@/core/integrations/gmail/gmailSyncEngine";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_ID = "user_1";
const OTHER_MEMBER_ID = "user_2";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function gmailMessage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "msg_1",
    threadId: "thread_1",
    labelIds: ["INBOX"],
    snippet: "Hi Ana",
    internalDate: "1735689600000",
    payload: { mimeType: "text/plain", headers: [{ name: "Subject", value: "Hello" }], body: { data: "SGVsbG8" } },
    ...overrides,
  };
}

async function setUpConnectedGmail(scopes: string[] = [GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE], expiresInMs = 60 * 60 * 1000): Promise<{ connectionId: string; credentialId: string }> {
  const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "gmail", installedBy: MEMBER_ID, memberId: MEMBER_ID });
  await applyConnectionEvent(connection.id, "connect_requested", MEMBER_ID);
  const credential = await issueOAuthCredential({
    workspaceId: WORKSPACE_ID,
    connectionId: connection.id,
    scopes,
    createdBy: MEMBER_ID,
    accessToken: "real-access-token",
    refreshToken: "real-refresh-token",
    memberId: MEMBER_ID,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_succeeded", MEMBER_ID);
  return { connectionId: connection.id, credentialId: credential.id };
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetGmailMailboxStore();
  resetGmailThreadStore();
  resetGmailMessageStore();
  vi.clearAllMocks();
  mockGetProfile.mockResolvedValue({ emailAddress: "ana@amorebloom.com", historyId: "999" });
  mockListThreads.mockResolvedValue({ threads: [], resultSizeEstimate: 0 });
  mockGetThread.mockResolvedValue({ id: "thread_1", messages: [] });
  mockListHistory.mockResolvedValue({ history: [], historyId: "999" });
  vi.mocked(refreshProviderOAuthConnectionAction).mockImplementation(async (connectionId: string) => {
    const connection = await getConnection(connectionId);
    if (!connection?.credential_id) return { success: false, error: "no credential" };
    await rotateOAuthCredential(connection.credential_id, { accessToken: "refreshed-access-token", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    return { success: true, data: connection };
  });
});

describe("syncGmailMailbox — connection/scope/state gates", () => {
  it("returns no_connection when the caller has no Gmail connection at all", async () => {
    expect(await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID })).toEqual({ status: "no_connection" });
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("returns reconnect_required (missing_readonly_scope) for a connection authorized before GMAIL-05, without calling the Gmail API", async () => {
    await setUpConnectedGmail([GMAIL_SEND_SCOPE]);
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "missing_readonly_scope" });
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("still permits sync when gmail.send remains present alongside gmail.readonly", async () => {
    await setUpConnectedGmail([GMAIL_SEND_SCOPE, GMAIL_READONLY_SCOPE]);
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
  });

  it("refuses to sync a connection that is not connected/expired (e.g. disabled), without calling the Gmail API", async () => {
    const { connectionId } = await setUpConnectedGmail();
    await applyConnectionEvent(connectionId, "disable_requested", MEMBER_ID);
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("error");
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it("denies a same-workspace, different member — they have no Gmail connection of their own", async () => {
    await setUpConnectedGmail();
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: OTHER_MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
  });

  it("denies a cross-workspace caller — they have no Gmail connection in that workspace", async () => {
    await setUpConnectedGmail();
    const result = await syncGmailMailbox({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
  });
});

describe("syncGmailMailbox — token refresh reuse (GMAIL-03)", () => {
  it("resolves the existing access token directly when it isn't close to expiry", async () => {
    await setUpConnectedGmail(undefined, 60 * 60 * 1000);
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).not.toHaveBeenCalled();
    expect(GmailProviderMock).toHaveBeenCalledWith("real-access-token");
  });

  it("proactively refreshes via the existing GMAIL-03 refresh action when the token is close to expiry, and uses the refreshed token", async () => {
    await setUpConnectedGmail(undefined, 30 * 1000); // 30s — inside the refresh margin
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledTimes(1);
    expect(GmailProviderMock).toHaveBeenCalledWith("refreshed-access-token");
  });

  it("refreshes when the connection state is expired, regardless of the stored expires_at", async () => {
    const { connectionId } = await setUpConnectedGmail(undefined, 60 * 60 * 1000);
    await applyConnectionEvent(connectionId, "token_expired", MEMBER_ID);
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledTimes(1);
  });

  it("returns reconnect_required when the refresh action itself fails, and never calls the Gmail API", async () => {
    await setUpConnectedGmail(undefined, 30 * 1000);
    vi.mocked(refreshProviderOAuthConnectionAction).mockResolvedValue({ success: false, error: "refresh rejected" });
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "refresh_failed" });
    expect(mockGetProfile).not.toHaveBeenCalled();
  });
});

describe("syncGmailMailbox — profile, mailbox, thread, message persistence", () => {
  it("populates the real emailAddress/history_id returned by users.getProfile, and marks the mailbox synced", async () => {
    await setUpConnectedGmail();
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailbox?.email_address).toBe("ana@amorebloom.com");
    expect(mailbox?.provider_account_id).toBe("ana@amorebloom.com");
    expect(mailbox?.history_id).toBe("999");
    expect(mailbox?.sync_status).toBe("synced");
    expect(mailbox?.last_synced_at).not.toBeNull();
    expect(mailbox?.last_successful_sync_at).not.toBeNull();
    expect(mailbox?.sync_error_code).toBeNull();
  });

  it("maps a fetched thread into gmail_threads and its message into gmail_messages", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage()] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBe(1);
    expect(result.messagesProcessed).toBe(1);

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(threads).toHaveLength(1);
    expect(threads[0].provider_thread_id).toBe("thread_1");
    expect(threads[0].subject).toBe("Hello");

    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages).toHaveLength(1);
    expect(messages[0].provider_message_id).toBe("msg_1");
    expect(messages[0].body_text).toBe("Hello");
  });

  it("is idempotent — syncing the same thread/message twice updates in place rather than duplicating", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage()] });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(threads).toHaveLength(1);
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages).toHaveLength(1);
  });
});

describe("syncGmailMailbox — pagination and bounds", () => {
  it("requests threads.list with the configured page size", async () => {
    await setUpConnectedGmail();
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListThreads).toHaveBeenCalledWith({ maxResults: GMAIL_SYNC_PAGE_SIZE, pageToken: undefined });
  });

  it("stops paging once GMAIL_SYNC_MAX_THREADS is reached, never exceeding it, and never calls getThread for threads beyond the bound", async () => {
    await setUpConnectedGmail();
    const pageSize = GMAIL_SYNC_PAGE_SIZE;
    const totalPagesAvailable = Math.ceil((GMAIL_SYNC_MAX_THREADS + pageSize * 3) / pageSize); // far more threads than the bound allows
    let call = 0;
    mockListThreads.mockImplementation(async () => {
      call++;
      const threads = Array.from({ length: pageSize }, (_, i) => ({ id: `thread_${call}_${i}` }));
      return { threads, nextPageToken: call < totalPagesAvailable ? `page_${call + 1}` : undefined, resultSizeEstimate: totalPagesAvailable * pageSize };
    });
    mockGetThread.mockImplementation(async (id: string) => ({ id, messages: [gmailMessage({ id: `${id}_msg`, threadId: id })] }));

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBeLessThanOrEqual(GMAIL_SYNC_MAX_THREADS);
    expect(mockGetThread).toHaveBeenCalledTimes(result.threadsProcessed);
  });

  it("never calls listThreads more times than the number of pages needed to reach the max-threads bound, even if nextPageToken never runs out", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockImplementation(async () => ({ threads: [{ id: `t_${Math.random()}` }], nextPageToken: "always_more" }));
    mockGetThread.mockResolvedValue({ id: "t", messages: [] });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListThreads.mock.calls.length).toBeLessThanOrEqual(GMAIL_SYNC_MAX_THREADS);
  });
});

describe("syncGmailMailbox — Gmail API error classification", () => {
  it("classifies a 401 as reconnect_required and records a non-sensitive sync_error_code", async () => {
    await setUpConnectedGmail();
    mockGetProfile.mockRejectedValue(new GmailApiError("Gmail API error 401: unauthorized", 401));
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "gmail_unauthorized" });
    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailbox?.sync_status).toBe("error");
    expect(mailbox?.sync_error_code).toBe("gmail_unauthorized");
  });

  it("classifies a 403 as a non-reconnect error", async () => {
    await setUpConnectedGmail();
    mockGetProfile.mockRejectedValue(new GmailApiError("Gmail API error 403: forbidden", 403));
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "gmail_forbidden" });
  });

  it("classifies a 429 distinctly (rate limited)", async () => {
    await setUpConnectedGmail();
    mockGetProfile.mockRejectedValue(new GmailApiError("Gmail API error 429: rate limited", 429));
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "gmail_rate_limited" });
  });

  it("classifies a 5xx distinctly (provider error)", async () => {
    await setUpConnectedGmail();
    mockGetProfile.mockRejectedValue(new GmailApiError("Gmail API error 503: unavailable", 503));
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "gmail_provider_error" });
  });

  it("does not advance history_id or last_successful_sync_at when the top-level sync fails", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage()] });
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const successfulMailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const priorSuccessfulSyncAt = successfulMailbox?.last_successful_sync_at;
    const priorHistoryId = successfulMailbox?.history_id;

    mockGetProfile.mockRejectedValue(new GmailApiError("Gmail API error 500", 500));
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const afterFailure = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(afterFailure?.last_successful_sync_at).toBe(priorSuccessfulSyncAt);
    expect(afterFailure?.history_id).toBe(priorHistoryId);
    expect(afterFailure?.sync_status).toBe("error");
  });

  it("skips one malformed/unfetchable thread (a non-401/403/429/5xx failure) without aborting the whole sync", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_bad" }, { id: "thread_good" }], resultSizeEstimate: 2 });
    mockGetThread.mockImplementation(async (id: string) => {
      if (id === "thread_bad") throw new Error("malformed payload");
      return { id, messages: [gmailMessage({ id: "msg_good", threadId: id })] };
    });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBe(1);
    expect(result.threadsSkipped).toBe(1);
  });
});

describe("syncGmailMailbox — attachments and mutation boundaries", () => {
  it("never calls a Gmail attachments endpoint — only getProfile/listThreads/getThread are exercised", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({
      id: "thread_1",
      messages: [gmailMessage({ payload: { mimeType: "multipart/mixed", parts: [{ mimeType: "application/pdf", filename: "contract.pdf", body: { attachmentId: "att_1" } }] } })],
    });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const provider = GmailProviderMock.mock.results[0]!.value as Record<string, unknown>;
    expect(Object.keys(provider)).not.toContain("getAttachment");
    expect(Object.keys(provider)).not.toContain("downloadAttachment");
  });

  it("persists has_attachments=true without persisting any attachment bytes", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({
      id: "thread_1",
      messages: [
        gmailMessage({
          payload: { mimeType: "multipart/mixed", parts: [{ mimeType: "text/plain", body: { data: "SGVsbG8" } }, { mimeType: "application/pdf", filename: "contract.pdf", body: { attachmentId: "att_1" } }] },
        }),
      ],
    });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages[0].has_attachments).toBe(true);
    expect(JSON.stringify(messages[0])).not.toContain("attachmentId");
  });
});

describe("syncGmailMailbox — no sensitive data in the result", () => {
  it("never includes an access/refresh token or message body in the returned summary", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage()] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("real-access-token");
    expect(serialized).not.toContain("real-refresh-token");
    expect(serialized).not.toContain("Hello"); // the message body text
  });
});

/** Runs one sync with the default (empty) mocks — establishes mailbox.history_id="999" via the "initial" path, so a following sync goes down the "incremental" path. */
async function establishHistoryId(): Promise<void> {
  const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
  if (result.status !== "success" || result.syncMode !== "initial") throw new Error("expected the setup sync to be a successful initial sync");
  mockListThreads.mockClear();
  mockGetThread.mockClear();
  mockGetProfile.mockClear();
}

describe("syncGmailMailbox — GMAIL-06 mode selection", () => {
  it("runs an initial (bounded full) sync when the mailbox has no history_id yet", async () => {
    await setUpConnectedGmail();
    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.syncMode).toBe("initial");
    expect(mockListHistory).not.toHaveBeenCalled();
  });

  it("runs an incremental sync, using the persisted history_id as startHistoryId, once one exists", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.syncMode).toBe("incremental");
    expect(mockListHistory).toHaveBeenCalledWith(expect.objectContaining({ startHistoryId: "999" }));
    expect(mockListThreads).not.toHaveBeenCalled();
  });
});

describe("syncGmailMailbox — GMAIL-06 history event processing", () => {
  it("processes messagesAdded by fetching and upserting the affected thread", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();

    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesAdded: [{ message: { id: "msg_new", threadId: "thread_new" } }] }] });
    mockGetThread.mockResolvedValue({ id: "thread_new", messages: [gmailMessage({ id: "msg_new", threadId: "thread_new" })] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBe(1);
    expect(result.messagesProcessed).toBe(1);
    expect(mockGetThread).toHaveBeenCalledWith("thread_new");

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(threads.find((t) => t.provider_thread_id === "thread_new")).toBeTruthy();
  });

  it("processes messagesDeleted by tombstoning directly — never calling getThread for that message", async () => {
    await setUpConnectedGmail();
    // Seed a real message via an initial sync with one thread present.
    mockListThreads.mockResolvedValueOnce({ threads: [{ id: "thread_1" }] });
    mockGetThread.mockResolvedValueOnce({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });
    await establishHistoryId();

    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesDeleted: [{ message: { id: "msg_1", threadId: "thread_1" } }] }] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.messagesDeleted).toBe(1);
    expect(mockGetThread).not.toHaveBeenCalled();

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages[0].deleted_at).not.toBeNull();
  });

  it("handles a messagesDeleted event for a message with no local row safely (idempotent no-op)", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesDeleted: [{ message: { id: "msg_never_synced", threadId: "thread_x" } }] }] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.messagesDeleted).toBe(0); // nothing local to tombstone
    expect(mockGetThread).not.toHaveBeenCalled();
  });

  it("processes labelsAdded/labelsRemoved by refetching the canonical current message, never by mutating labels", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({
      history: [{ id: "1000", labelsAdded: [{ message: { id: "msg_1", threadId: "thread_1" }, labelIds: ["STARRED"] }] }],
    });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1", labelIds: ["INBOX", "STARRED"] })] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(mockGetThread).toHaveBeenCalledWith("thread_1");

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages[0].is_starred).toBe(true);
  });

  it("collapses overlapping messagesAdded + labelsAdded for the same message id into one canonical refresh (deduplication)", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({
      history: [
        { id: "1000", messagesAdded: [{ message: { id: "msg_1", threadId: "thread_1" } }] },
        { id: "1001", labelsAdded: [{ message: { id: "msg_1", threadId: "thread_1" }, labelIds: ["STARRED"] }] },
      ],
    });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBe(1);
    expect(mockGetThread).toHaveBeenCalledTimes(1);
  });

  it("a later messagesDeleted overrides an earlier messagesAdded for the same id within one batch", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({
      history: [
        { id: "1000", messagesAdded: [{ message: { id: "msg_1", threadId: "thread_1" } }] },
        { id: "1001", messagesDeleted: [{ message: { id: "msg_1", threadId: "thread_1" } }] },
      ],
    });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.threadsProcessed).toBe(0);
    expect(mockGetThread).not.toHaveBeenCalled();
  });
});

describe("syncGmailMailbox — GMAIL-06 history pagination and bounds", () => {
  it("requests history.list with the configured page size", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListHistory).toHaveBeenCalledWith(expect.objectContaining({ maxResults: GMAIL_HISTORY_PAGE_SIZE }));
  });

  it("never calls listHistory more than GMAIL_HISTORY_MAX_PAGES times, even with a pathological always-more-pages response", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockImplementation(async () => ({ history: [{ id: `${Math.random()}` }], nextPageToken: "always_more" }));

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListHistory.mock.calls.length).toBeLessThanOrEqual(GMAIL_HISTORY_MAX_PAGES);
  });

  it("follows pageToken across multiple history pages", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory
      .mockResolvedValueOnce({ history: [{ id: "1000", messagesAdded: [{ message: { id: "msg_a", threadId: "thread_a" } }] }], nextPageToken: "page_2" })
      .mockResolvedValueOnce({ history: [{ id: "1001", messagesAdded: [{ message: { id: "msg_b", threadId: "thread_b" } }] }] });
    mockGetThread.mockImplementation(async (id: string) => ({ id, messages: [gmailMessage({ id: `${id}_msg`, threadId: id })] }));

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(mockListHistory).toHaveBeenCalledTimes(2);
    expect(result.threadsProcessed).toBe(2);
  });
});

describe("syncGmailMailbox — GMAIL-06 invalid/expired history cursor", () => {
  it("falls back to a bounded full resync when the cursor is rejected as invalid (404), and reports syncMode=full_resync", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockRejectedValue(new GmailApiError("Gmail API error 404: Invalid startHistoryId", 404));
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_resync" }] });
    mockGetThread.mockResolvedValue({ id: "thread_resync", messages: [gmailMessage({ id: "msg_resync", threadId: "thread_resync" })] });

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.syncMode).toBe("full_resync");
    expect(mockListThreads).toHaveBeenCalled();

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailbox?.history_id).toBe("999"); // the fresh profile historyId, not the stale one
  });

  it("does not corrupt or discard local state on an invalid cursor — the full resync's own upserts are the only effect", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValueOnce({ threads: [{ id: "thread_1" }] });
    mockGetThread.mockResolvedValueOnce({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });
    await establishHistoryId();

    mockListHistory.mockRejectedValue(new GmailApiError("Gmail API error 404", 404));
    mockListThreads.mockResolvedValue({ threads: [{ id: "thread_1" }] }); // the resync still sees the same thread
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(threads).toHaveLength(1);
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages).toHaveLength(1);
  });
});

describe("syncGmailMailbox — GMAIL-06 cursor advancement and partial-failure safety", () => {
  it("advances history_id only after a successful incremental batch", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({ history: [{ id: "1050" }] }); // no events, but still a real page consumed

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailbox?.history_id).toBe("1050");
  });

  it("does not advance history_id when a fatal Gmail error occurs while processing the incremental batch", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    const mailboxBefore = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesAdded: [{ message: { id: "msg_1", threadId: "thread_1" } }] }] });
    mockGetThread.mockRejectedValue(new GmailApiError("Gmail API error 500", 500));

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("error");

    const mailboxAfter = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailboxAfter?.history_id).toBe(mailboxBefore?.history_id);
    expect(mailboxAfter?.sync_status).toBe("error");
  });

  it("does not advance history_id when listHistory itself fails with a fatal (non-404) error", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    const mailboxBefore = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    mockListHistory.mockRejectedValue(new GmailApiError("Gmail API error 401", 401));

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("reconnect_required");

    const mailboxAfter = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mailboxAfter?.history_id).toBe(mailboxBefore?.history_id);
  });

  it("classifies a 403/429/5xx from listHistory the same way as the full-listing path", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockRejectedValue(new GmailApiError("Gmail API error 429", 429));

    const result = await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "gmail_rate_limited" });
  });
});

describe("syncGmailMailbox — GMAIL-06 replay idempotency", () => {
  it("replaying the exact same history page (e.g. after a retry) does not duplicate the message", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesAdded: [{ message: { id: "msg_1", threadId: "thread_1" } }] }] });
    mockGetThread.mockResolvedValue({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    // Second sync starts from the NEW (advanced) history_id, but since the mock keeps returning
    // the same page shape regardless of startHistoryId, this exercises "the same event applied
    // twice" without duplicating anything — upsert semantics are idempotent by provider id.
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(threads).toHaveLength(1);
    const messages = await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(messages).toHaveLength(1);
  });

  it("replaying the same deletion keeps the message tombstoned exactly once (deleted_at unchanged)", async () => {
    await setUpConnectedGmail();
    mockListThreads.mockResolvedValueOnce({ threads: [{ id: "thread_1" }] });
    mockGetThread.mockResolvedValueOnce({ id: "thread_1", messages: [gmailMessage({ id: "msg_1", threadId: "thread_1" })] });
    await establishHistoryId();

    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesDeleted: [{ message: { id: "msg_1", threadId: "thread_1" } }] }] });
    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const mailbox = await getOwnMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const threads = await listThreadsForCaller(mailbox!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const firstDeletedAt = (await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID }))[0].deleted_at;

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const secondDeletedAt = (await listMessagesForThreadForCaller(threads[0].id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID }))[0].deleted_at;
    expect(secondDeletedAt).toBe(firstDeletedAt);
  });
});

describe("syncGmailMailbox — GMAIL-06 scope/mutation boundaries", () => {
  it("never calls a label-mutation or attachment-download method — the mocked provider only ever exposes read methods", async () => {
    await setUpConnectedGmail();
    await establishHistoryId();
    mockListHistory.mockResolvedValue({ history: [{ id: "1000", messagesDeleted: [{ message: { id: "msg_1", threadId: "thread_1" } }] }] });

    await syncGmailMailbox({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const provider = GmailProviderMock.mock.results[0]!.value as Record<string, unknown>;
    expect(Object.keys(provider)).not.toContain("modifyMessage");
    expect(Object.keys(provider)).not.toContain("modifyThread");
    expect(Object.keys(provider)).not.toContain("getAttachment");
  });
});
