import { createHmac } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";
import { TwilioProvider, normalizePhoneNumber } from "@/core/integrations/providers/twilio/twilioProvider";

function signBody(body: string, secret: string): string {
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const concatenated = sortedKeys.reduce((acc, key) => acc + key + params.get(key), "");
  return createHmac("sha1", secret).update(concatenated).digest("base64");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TwilioProvider", () => {
  const provider = new TwilioProvider("AC_test_sid", "test_auth_token", "+15551234567");

  it("verifies a correctly-signed inbound webhook body", () => {
    const rawBody = "MessageSid=SM123&MessageStatus=delivered&To=%2B15559998888";
    const signature = signBody(rawBody, "test_auth_token");
    expect(provider.verifyInboundSignature({ rawBody, signatureHeader: signature, secret: "test_auth_token" })).toBe(true);
  });

  it("rejects a webhook body with a tampered field", () => {
    const rawBody = "MessageSid=SM123&MessageStatus=delivered&To=%2B15559998888";
    const signature = signBody(rawBody, "test_auth_token");
    const tamperedBody = "MessageSid=SM123&MessageStatus=failed&To=%2B15559998888";
    expect(provider.verifyInboundSignature({ rawBody: tamperedBody, signatureHeader: signature, secret: "test_auth_token" })).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const rawBody = "MessageSid=SM123&MessageStatus=delivered";
    const signature = signBody(rawBody, "wrong_secret");
    expect(provider.verifyInboundSignature({ rawBody, signatureHeader: signature, secret: "test_auth_token" })).toBe(false);
  });

  it("maps delivered/failed/undelivered to sms.delivered/sms.failed, and an unknown event to null", () => {
    expect(provider.mapInboundEvent("delivered")).toBe("sms.delivered");
    expect(provider.mapInboundEvent("failed")).toBe("sms.failed");
    expect(provider.mapInboundEvent("undelivered")).toBe("sms.failed");
    expect(provider.mapInboundEvent("queued")).toBeNull();
  });

  it("ping() reports failure honestly when the Twilio API call fails, never a fabricated success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 })),
    );
    const result = await provider.ping();
    expect(result.ok).toBe(false);
  });

  it("sendSms sends the message via Basic Auth and normalizes the destination number", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: "SM999", status: "queued" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await provider.sendSms({ to: "(555) 999-8888", body: "Hello" });
    expect(result.externalMessageId).toBe("SM999");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    expect(String(init.body)).toContain("To=%2B5559998888");
  });

  it("sendEmail throws honestly rather than silently no-oping", async () => {
    await expect(provider.sendEmail()).rejects.toThrow(/does not support email/);
  });
});

describe("normalizePhoneNumber", () => {
  it("strips formatting and keeps a leading +", () => {
    expect(normalizePhoneNumber("(555) 123-4567")).toBe("+5551234567");
    expect(normalizePhoneNumber("+1 555 123 4567")).toBe("+15551234567");
  });
});
