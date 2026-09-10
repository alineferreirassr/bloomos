import type { CommunicationProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";
import type { GmailApiHistoryListResponse, GmailApiProfile, GmailApiThread, GmailApiThreadListResponse } from "@/core/integrations/providers/gmail/gmailApiTypes";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A Gmail API error carrying the real HTTP status, so callers (the sync engine) can classify 401/403/429/5xx without re-parsing a message string. */
export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

/**
 * v2 Checkpoint 43 — a real Gmail send-mail implementation against the
 * real Gmail REST API (`users.messages.send`, RFC 2822 message base64url-
 * encoded per Gmail's own documented format). Plain `fetch`, no
 * `googleapis` dependency, matching `GoogleCalendarProvider`'s own
 * reasoning.
 *
 * GMAIL-05 adds the read-only surface `gmailSyncEngine.ts` needs
 * (`getProfile`/`listThreads`/`getThread`) — same class, same `request<T>`
 * pattern `GoogleCalendarProvider` already established, so there is one
 * canonical Gmail API client, not a second one scattered across the sync
 * engine. `sendSms` still throws, honestly, since Gmail has no SMS
 * capability.
 *
 * Connection is unverified in this environment — no Google OAuth client
 * is configured, so this has never made a real Gmail API call. See
 * docs/email-integration.md.
 */
export class GmailProvider implements CommunicationProvider {
  readonly providerId = "gmail";
  readonly capabilities: ProviderCapability[] = ["communication", "oauth"];

  constructor(
    private readonly accessToken: string,
    private readonly fromAddress?: string,
  ) {}

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${GMAIL_API_BASE}${path}`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GmailApiError(`Gmail API error ${response.status}: ${body.slice(0, 200)}`, response.status);
    }
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.request(`/users/me/profile`);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /** `users.getProfile` — the mailbox's own address and its current `historyId` (the cursor a future incremental sync would start from). Requires `gmail.readonly` (or broader); a `gmail.send`-only token still succeeds here since Google scopes `getProfile` under either. */
  async getProfile(): Promise<GmailApiProfile> {
    return this.request<GmailApiProfile>(`/users/me/profile`);
  }

  /** `users.threads.list` — bounded by the caller's own `maxResults`/`pageToken`; this method does not itself decide how many pages to fetch, that bound lives in `gmailSyncEngine.ts`. */
  async listThreads(params: { maxResults: number; pageToken?: string }): Promise<GmailApiThreadListResponse> {
    const query = new URLSearchParams({ maxResults: String(params.maxResults) });
    if (params.pageToken) query.set("pageToken", params.pageToken);
    return this.request<GmailApiThreadListResponse>(`/users/me/threads?${query.toString()}`);
  }

  /** `users.threads.get` with `format=full` — every message in the thread, full MIME payload. Never fetches attachment bytes (`format=full` includes headers/body text/HTML but not `attachments.get`'s binary payload). */
  async getThread(threadId: string): Promise<GmailApiThread> {
    return this.request<GmailApiThread>(`/users/me/threads/${encodeURIComponent(threadId)}?format=full`);
  }

  /**
   * `users.history.list` — GMAIL-06's incremental-sync read. Google
   * returns HTTP 404 when `startHistoryId` is too old/invalid (history
   * records have been purged); callers (`gmailSyncEngine.ts`) classify
   * that `GmailApiError.status === 404` as "must fall back to a full
   * resync," never as a generic failure.
   */
  async listHistory(params: { startHistoryId: string; pageToken?: string; maxResults?: number }): Promise<GmailApiHistoryListResponse> {
    const query = new URLSearchParams({ startHistoryId: params.startHistoryId });
    if (params.pageToken) query.set("pageToken", params.pageToken);
    if (params.maxResults) query.set("maxResults", String(params.maxResults));
    return this.request<GmailApiHistoryListResponse>(`/users/me/history?${query.toString()}`);
  }

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<{ externalMessageId: string; status: string }> {
    if (!this.fromAddress) throw new Error("GmailProvider was constructed without a fromAddress — cannot send.");
    const rfc2822 = [`From: ${this.fromAddress}`, `To: ${params.to}`, `Subject: ${params.subject}`, "Content-Type: text/html; charset=utf-8", "", params.body].join("\r\n");
    const response = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: toBase64Url(rfc2822) }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gmail send error ${response.status}: ${body.slice(0, 200)}`);
    }
    const result = (await response.json()) as { id: string };
    return { externalMessageId: result.id, status: "sent" };
  }

  async sendSms(): Promise<{ externalMessageId: string; status: string }> {
    throw new Error("GmailProvider does not support SMS — use TwilioProvider for sendSms.");
  }
}
