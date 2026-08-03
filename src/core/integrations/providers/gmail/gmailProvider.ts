import type { CommunicationProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * v2 Checkpoint 43 — a real Gmail send-mail implementation against the
 * real Gmail REST API (`users.messages.send`, RFC 2822 message base64url-
 * encoded per Gmail's own documented format). Plain `fetch`, no
 * `googleapis` dependency, matching `GoogleCalendarProvider`'s own
 * reasoning. Only `sendEmail` is implemented — `sendSms` throws, honestly,
 * since Gmail has no SMS capability; this class exists specifically for
 * `CommunicationProvider`'s email half.
 *
 * Connection is unverified in this environment — no Google OAuth client
 * is configured, so this has never sent a real message. See
 * docs/email-integration.md.
 */
export class GmailProvider implements CommunicationProvider {
  readonly providerId = "gmail";
  readonly capabilities: ProviderCapability[] = ["communication", "oauth"];

  constructor(
    private readonly accessToken: string,
    private readonly fromAddress: string,
  ) {}

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${GMAIL_API_BASE}/users/me/profile`, { headers: { Authorization: `Bearer ${this.accessToken}` } });
      if (!response.ok) throw new Error(`Gmail API error ${response.status}`);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendEmail(params: { to: string; subject: string; body: string }): Promise<{ externalMessageId: string; status: string }> {
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
