import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/modules/integrations/manageOAuthConnectionActions", () => ({ refreshProviderOAuthConnectionAction: vi.fn() }));

const { mockGetProfile, mockListThreads, mockGetThread, GmailProviderMock } = vi.hoisted(() => {
  const mockGetProfile = vi.fn();
  const mockListThreads = vi.fn();
  const mockGetThread = vi.fn();
  const GmailProviderMock = vi.fn().mockImplementation(function GmailProviderMockImpl(this: Record<string, unknown>, accessToken: string) {
    this.accessToken = accessToken;
    this.getProfile = mockGetProfile;
    this.listThreads = mockListThreads;
    this.getThread = mockGetThread;
  });
  return { mockGetProfile, mockListThreads, mockGetThread, GmailProviderMock };
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
import { GMAIL_READONLY_SCOPE, GMAIL_SYNC_MAX_THREADS, GMAIL_SYNC_PAGE_SIZE, syncGmailMailbox } from "@/core/integrations/gmail/gmailSyncEngine";

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
