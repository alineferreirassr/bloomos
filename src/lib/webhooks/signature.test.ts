import { describe, expect, it } from "vitest";
import { signWebhookPayload, buildSignatureHeader, verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER } from "@/lib/webhooks/signature";

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ hello: "world" });

describe("signWebhookPayload / buildSignatureHeader", () => {
  it("produces a deterministic hex digest for the same secret/timestamp/body", async () => {
    const a = await signWebhookPayload(SECRET, "1700000000", BODY);
    const b = await signWebhookPayload(SECRET, "1700000000", BODY);
    expect(a).toEqual(b);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it("produces a different digest for a different secret, timestamp, or body", async () => {
    const base = await signWebhookPayload(SECRET, "1700000000", BODY);
    expect(await signWebhookPayload("whsec_other", "1700000000", BODY)).not.toEqual(base);
    expect(await signWebhookPayload(SECRET, "1700000001", BODY)).not.toEqual(base);
    expect(await signWebhookPayload(SECRET, "1700000000", JSON.stringify({ hello: "moon" }))).not.toEqual(base);
  });

  it("buildSignatureHeader shapes t=<timestamp>,v1=<signature>", () => {
    expect(buildSignatureHeader("abc123", "1700000000")).toBe("t=1700000000,v1=abc123");
  });

  it("exports the header name every dispatch/verification call site shares", () => {
    expect(WEBHOOK_SIGNATURE_HEADER).toBe("x-bloomos-signature");
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a signature computed by signWebhookPayload for the same payload/secret, within tolerance", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const signature = await signWebhookPayload(SECRET, timestamp, BODY);
    const header = buildSignatureHeader(signature, timestamp);

    const result = await verifyWebhookSignature({ payload: BODY, header, secret: SECRET, now });
    expect(result.valid).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const signature = await signWebhookPayload(SECRET, timestamp, BODY);
    const header = buildSignatureHeader(signature, timestamp);

    const result = await verifyWebhookSignature({ payload: JSON.stringify({ hello: "tampered" }), header, secret: SECRET, now });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not match/i);
  });

  it("rejects the wrong secret", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const timestamp = Math.floor(now.getTime() / 1000).toString();
    const signature = await signWebhookPayload(SECRET, timestamp, BODY);
    const header = buildSignatureHeader(signature, timestamp);

    const result = await verifyWebhookSignature({ payload: BODY, header, secret: "whsec_wrong", now });
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed header", async () => {
    const result = await verifyWebhookSignature({ payload: BODY, header: "not-a-real-header", secret: SECRET });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/malformed/i);
  });

  it("rejects a timestamp outside the tolerance window — real replay mitigation", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const timestamp = Math.floor(past.getTime() / 1000).toString();
    const signature = await signWebhookPayload(SECRET, timestamp, BODY);
    const header = buildSignatureHeader(signature, timestamp);

    const muchLater = new Date(past.getTime() + 10 * 60 * 1000); // 10 minutes later, default tolerance is 5 minutes
    const result = await verifyWebhookSignature({ payload: BODY, header, secret: SECRET, now: muchLater });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/replay/i);
  });

  it("honors a custom toleranceSeconds", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const timestamp = Math.floor(past.getTime() / 1000).toString();
    const signature = await signWebhookPayload(SECRET, timestamp, BODY);
    const header = buildSignatureHeader(signature, timestamp);

    const tenSecondsLater = new Date(past.getTime() + 10_000);
    const result = await verifyWebhookSignature({ payload: BODY, header, secret: SECRET, now: tenSecondsLater, toleranceSeconds: 5 });
    expect(result.valid).toBe(false);
  });
});
