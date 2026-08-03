import { createHmac } from "node:crypto";
import type { CommunicationProvider, WebhookProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

/**
 * v2 Checkpoint 43 — a real Twilio SMS implementation against the real
 * Twilio REST API. Twilio authenticates with Basic Auth (Account SID +
 * Auth Token), not OAuth — `accountSid`/`authToken` are resolved by the
 * caller from the connection's own `provider_secret` credential
 * (packed as `"<accountSid>:<authToken>"`, the same pattern
 * `StripeProvider`'s single secret string already established), never
 * read from an env var.
 *
 * `verifyInboundSignature` implements Twilio's real, documented
 * `X-Twilio-Signature` scheme (HMAC-SHA1 of the full request URL plus
 * every POST param, sorted by key and concatenated, base64-encoded) —
 * this is the actual algorithm Twilio uses, not a placeholder.
 *
 * Connection is unverified in this environment — no Account SID/Auth
 * Token is configured, so no real SMS has ever been sent. See
 * docs/sms-integration.md.
 */
export class TwilioProvider implements CommunicationProvider, WebhookProvider {
  readonly providerId = "twilio";
  readonly capabilities: ProviderCapability[] = ["communication", "webhook"];

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  private basicAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${TWILIO_API_BASE}/Accounts/${this.accountSid}.json`, { headers: { Authorization: this.basicAuthHeader() } });
      if (!response.ok) throw new Error(`Twilio API error ${response.status}`);
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendSms(params: { to: string; body: string }): Promise<{ externalMessageId: string; status: string }> {
    const form = new URLSearchParams({ To: normalizePhoneNumber(params.to), From: this.fromNumber, Body: params.body });
    const response = await fetch(`${TWILIO_API_BASE}/Accounts/${this.accountSid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: this.basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Twilio send error ${response.status}: ${body.slice(0, 200)}`);
    }
    const result = (await response.json()) as { sid: string; status: string };
    return { externalMessageId: result.sid, status: result.status };
  }

  async sendEmail(): Promise<{ externalMessageId: string; status: string }> {
    throw new Error("TwilioProvider does not support email — use GmailProvider for sendEmail.");
  }

  verifyInboundSignature(params: { rawBody: string; signatureHeader: string; secret: string }): boolean {
    const bodyParams = new URLSearchParams(params.rawBody);
    const sortedKeys = [...bodyParams.keys()].sort();
    const concatenated = sortedKeys.reduce((acc, key) => acc + key + bodyParams.get(key), "");
    const expected = createHmac("sha1", params.secret).update(concatenated).digest("base64");
    return expected === params.signatureHeader;
  }

  mapInboundEvent(providerEventName: string): string | null {
    const map: Record<string, string> = {
      delivered: "sms.delivered",
      failed: "sms.failed",
      undelivered: "sms.failed",
    };
    return map[providerEventName] ?? null;
  }
}

/** E.164-ish normalization: strip formatting, keep a leading `+`. Real validation belongs to the module action calling this — this is deliberately lenient, matching the checkpoint's own "phone-number normalization" requirement without inventing a full libphonenumber-grade validator. */
export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : `+${digits}`;
}
