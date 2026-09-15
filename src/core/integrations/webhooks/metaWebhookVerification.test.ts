import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from "@/core/integrations/webhooks/metaWebhookVerification";

const ORIGINAL_APP_SECRET = process.env.META_OAUTH_CLIENT_SECRET;
const ORIGINAL_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

beforeEach(() => {
  process.env.META_OAUTH_CLIENT_SECRET = "test_app_secret";
  process.env.META_WEBHOOK_VERIFY_TOKEN = "test_verify_token";
});

afterEach(() => {
  process.env.META_OAUTH_CLIENT_SECRET = ORIGINAL_APP_SECRET;
  process.env.META_WEBHOOK_VERIFY_TOKEN = ORIGINAL_VERIFY_TOKEN;
});

function sign(body: string, secret = "test_app_secret"): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifyMetaWebhookChallenge", () => {
  it("valid handshake — mode subscribe, matching token, real challenge — is verified and echoes the challenge back", () => {
    const result = verifyMetaWebhookChallenge({ mode: "subscribe", verifyToken: "test_verify_token", challenge: "random_challenge_123" });
    expect(result).toEqual({ verified: true, challenge: "random_challenge_123" });
  });

  it("invalid handshake — wrong verify token — fails closed", () => {
    const result = verifyMetaWebhookChallenge({ mode: "subscribe", verifyToken: "wrong_token", challenge: "random_challenge_123" });
    expect(result).toEqual({ verified: false });
  });

  it("invalid handshake — wrong mode — fails closed", () => {
    const result = verifyMetaWebhookChallenge({ mode: "unsubscribe", verifyToken: "test_verify_token", challenge: "random_challenge_123" });
    expect(result).toEqual({ verified: false });
  });

  it("invalid handshake — missing challenge — fails closed", () => {
    const result = verifyMetaWebhookChallenge({ mode: "subscribe", verifyToken: "test_verify_token", challenge: null });
    expect(result).toEqual({ verified: false });
  });

  it("never verifies when META_WEBHOOK_VERIFY_TOKEN is unset — a genuinely unconfigured deployment fails closed, never defaults to trusting any token", () => {
    delete process.env.META_WEBHOOK_VERIFY_TOKEN;
    const result = verifyMetaWebhookChallenge({ mode: "subscribe", verifyToken: "anything", challenge: "random_challenge_123" });
    expect(result).toEqual({ verified: false });
  });
});

describe("verifyMetaWebhookSignature", () => {
  it("valid signature — computed with the real App Secret over the exact raw body — verifies", () => {
    const body = '{"object":"instagram","entry":[{"id":"acct_1"}]}';
    expect(verifyMetaWebhookSignature(body, sign(body))).toBe(true);
  });

  it("invalid signature — wrong secret — fails", () => {
    const body = '{"object":"instagram","entry":[{"id":"acct_1"}]}';
    expect(verifyMetaWebhookSignature(body, sign(body, "wrong_secret"))).toBe(false);
  });

  it("invalid signature — tampered body after signing — fails", () => {
    const body = '{"object":"instagram","entry":[{"id":"acct_1"}]}';
    const signature = sign(body);
    expect(verifyMetaWebhookSignature('{"object":"instagram","entry":[{"id":"acct_HIJACKED"}]}', signature)).toBe(false);
  });

  it("no signature header — request without authentication — fails", () => {
    expect(verifyMetaWebhookSignature("{}", null)).toBe(false);
  });

  it("malformed signature header — wrong algorithm prefix — fails", () => {
    const body = '{"object":"instagram","entry":[]}';
    expect(verifyMetaWebhookSignature(body, `sha1=${createHmac("sha1", "test_app_secret").update(body).digest("hex")}`)).toBe(false);
  });

  it("malformed signature header — not valid hex — fails without throwing", () => {
    expect(verifyMetaWebhookSignature("{}", "sha256=not-hex-zzz")).toBe(false);
  });

  it("never verifies when META_OAUTH_CLIENT_SECRET is unset", () => {
    delete process.env.META_OAUTH_CLIENT_SECRET;
    const body = "{}";
    expect(verifyMetaWebhookSignature(body, sign(body))).toBe(false);
  });
});
