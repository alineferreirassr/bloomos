import { createHmac, timingSafeEqual } from "node:crypto";
import type { SignatureProvider, WebhookProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";

/**
 * v2 Checkpoint 43 — a real DocuSign e-signature implementation against
 * the real DocuSign eSignature REST API v2.1 (Envelopes resource). Plain
 * `fetch`, no `docusign-esign` SDK dependency, same reasoning as the
 * other Checkpoint 43 adapters. `accountBaseUri` is the per-account API
 * base DocuSign returns from its own `/oauth/userinfo` endpoint at
 * connect time (never hardcoded — DocuSign's accounts live on different
 * regional base URLs).
 *
 * `getSignatureStatus` maps DocuSign's own envelope statuses
 * (`sent`/`delivered`/`completed`/`declined`/`voided`) onto
 * `SignatureProvider`'s own vocabulary — BloomOS's Contract remains the
 * source of truth for what the *contract* is; this only reports what
 * DocuSign says about the request.
 *
 * Connection is unverified in this environment — no OAuth client is
 * configured, so no real envelope has ever been created. See
 * docs/signature-integration.md.
 */
export class DocuSignProvider implements SignatureProvider, WebhookProvider {
  readonly providerId = "docusign";
  readonly capabilities: ProviderCapability[] = ["signature", "webhook", "oauth"];

  constructor(
    private readonly accessToken: string,
    private readonly accountId: string,
    private readonly accountBaseUri: string,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.accountBaseUri}/restapi/v2.1/accounts/${this.accountId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`DocuSign API error ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.request("");
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async createSignatureRequest(params: { documentName: string; documentContent: Blob; signers: Array<{ name: string; email: string }> }): Promise<{ externalRequestId: string }> {
    const documentBase64 = Buffer.from(await params.documentContent.arrayBuffer()).toString("base64");
    const created = await this.request<{ envelopeId: string }>("/envelopes", {
      method: "POST",
      body: JSON.stringify({
        emailSubject: `Please sign: ${params.documentName}`,
        documents: [{ documentBase64, name: params.documentName, fileExtension: "pdf", documentId: "1" }],
        recipients: {
          signers: params.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: String(index + 1),
            routingOrder: String(index + 1),
            tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "100" }] },
          })),
        },
        status: "sent",
      }),
    });
    return { externalRequestId: created.envelopeId };
  }

  async getSignatureStatus(externalRequestId: string): Promise<{ status: "sent" | "viewed" | "partially_signed" | "signed" | "declined" | "expired" | "cancelled"; completedDocumentUrl: string | null }> {
    const envelope = await this.request<{ status: string }>(`/envelopes/${externalRequestId}`);
    const statusMap: Record<string, "sent" | "viewed" | "partially_signed" | "signed" | "declined" | "expired" | "cancelled"> = {
      sent: "sent",
      delivered: "viewed",
      completed: "signed",
      declined: "declined",
      voided: "cancelled",
    };
    const mapped = statusMap[envelope.status] ?? "sent";
    return {
      status: mapped,
      completedDocumentUrl: mapped === "signed" ? `${this.accountBaseUri}/restapi/v2.1/accounts/${this.accountId}/envelopes/${externalRequestId}/documents/combined` : null,
    };
  }

  async cancelSignatureRequest(externalRequestId: string): Promise<{ cancelled: boolean }> {
    await this.request(`/envelopes/${externalRequestId}`, { method: "PUT", body: JSON.stringify({ status: "voided", voidedReason: "Cancelled from BloomOS." }) });
    return { cancelled: true };
  }

  /** DocuSign Connect's real HMAC-SHA256 signature scheme (`X-DocuSign-Signature-1`), base64-encoded, timing-safe compared. */
  verifyInboundSignature(params: { rawBody: string; signatureHeader: string; secret: string }): boolean {
    const expected = createHmac("sha256", params.secret).update(params.rawBody, "utf8").digest("base64");
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(params.signatureHeader);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  mapInboundEvent(providerEventName: string): string | null {
    const map: Record<string, string> = {
      "envelope-completed": "signature.completed",
      "envelope-declined": "signature.declined",
      "envelope-voided": "signature.declined",
    };
    return map[providerEventName] ?? null;
  }
}
