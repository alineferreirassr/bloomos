import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { DocuSignProvider } from "@/core/integrations/providers/docusign/docusignProvider";

describe("DocuSignProvider", () => {
  const provider = new DocuSignProvider("test_access_token", "acct_123", "https://demo.docusign.net");

  it("verifies a correctly-signed inbound Connect webhook body", () => {
    const rawBody = JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" });
    const signature = createHmac("sha256", "connect_secret").update(rawBody, "utf8").digest("base64");
    expect(provider.verifyInboundSignature({ rawBody, signatureHeader: signature, secret: "connect_secret" })).toBe(true);
  });

  it("rejects a tampered payload even with the right secret", () => {
    const rawBody = JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" });
    const signature = createHmac("sha256", "connect_secret").update(rawBody, "utf8").digest("base64");
    const tampered = JSON.stringify({ event: "envelope-completed", envelopeId: "env_2" });
    expect(provider.verifyInboundSignature({ rawBody: tampered, signatureHeader: signature, secret: "connect_secret" })).toBe(false);
  });

  it("rejects a signature of a different length without throwing", () => {
    expect(provider.verifyInboundSignature({ rawBody: "{}", signatureHeader: "short", secret: "connect_secret" })).toBe(false);
  });

  it("maps envelope-completed/declined/voided correctly, and an unknown event to null", () => {
    expect(provider.mapInboundEvent("envelope-completed")).toBe("signature.completed");
    expect(provider.mapInboundEvent("envelope-declined")).toBe("signature.declined");
    expect(provider.mapInboundEvent("envelope-voided")).toBe("signature.declined");
    expect(provider.mapInboundEvent("recipient-viewed")).toBeNull();
  });

  it("getSignatureStatus maps DocuSign's own envelope statuses onto SignatureProvider's vocabulary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "completed" }), { status: 200 })),
    );
    const result = await provider.getSignatureStatus("env_1");
    expect(result.status).toBe("signed");
    expect(result.completedDocumentUrl).not.toBeNull();
    vi.unstubAllGlobals();
  });

  it("getSignatureStatus reports no document url for a non-completed envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "sent" }), { status: 200 })),
    );
    const result = await provider.getSignatureStatus("env_1");
    expect(result.status).toBe("sent");
    expect(result.completedDocumentUrl).toBeNull();
    vi.unstubAllGlobals();
  });
});
