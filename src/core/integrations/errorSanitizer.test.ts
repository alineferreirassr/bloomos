import { afterEach, describe, expect, it } from "vitest";
import { redactSecrets, sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import { resetErrorRecordStore } from "@/lib/data/core/integrations/errorRecordStore";

afterEach(() => {
  resetErrorRecordStore();
});

describe("core/integrations/errorSanitizer", () => {
  it("redacts a Bearer token", () => {
    expect(redactSecrets("Request failed: Bearer ya29.a0ARrdaM9abcdefghijklmnop")).not.toContain("ya29");
    expect(redactSecrets("Request failed: Bearer ya29.a0ARrdaM9abcdefghijklmnop")).toContain("[REDACTED]");
  });

  it("redacts a Stripe secret key regardless of surrounding context", () => {
    expect(redactSecrets("client init failed with key sk_test_51H8xJ2KZvNjOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")).not.toContain("sk_test_51H8xJ2KZvNjO");
  });

  it("redacts a Stripe webhook signing secret", () => {
    expect(redactSecrets("bad signature for whsec_abcdefghijklmnopqrstuvwxyz123456")).not.toContain("whsec_abcdefghijklmnopqrstuvwxyz123456");
  });

  it("redacts a key=value style assignment", () => {
    expect(redactSecrets('auth failed: {"apiKey": "abcdef1234567890ghijk"}')).not.toContain("abcdef1234567890ghijk");
  });

  it("redacts a long opaque token even with no other pattern match", () => {
    const redacted = redactSecrets("unexpected value AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA in response");
    expect(redacted).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  });

  it("leaves an ordinary short error message untouched", () => {
    expect(redactSecrets("Not found")).toBe("Not found");
  });

  it("classifies a 401 as auth and marks it non-retryable", () => {
    const record = sanitizeIntegrationError({ connectionId: "conn_1", providerId: "twilio", rawMessage: "Unauthorized", statusCode: 401 });
    expect(record.category).toBe("auth");
    expect(record.retryable).toBe(false);
  });

  it("classifies a 429 as rate_limit and marks it retryable", () => {
    const record = sanitizeIntegrationError({ connectionId: "conn_1", providerId: "twilio", rawMessage: "Too many requests", statusCode: 429 });
    expect(record.category).toBe("rate_limit");
    expect(record.retryable).toBe(true);
  });

  it("classifies a 503 as provider_unavailable and marks it retryable", () => {
    const record = sanitizeIntegrationError({ connectionId: "conn_1", providerId: "docusign", rawMessage: "Service unavailable", statusCode: 503 });
    expect(record.category).toBe("provider_unavailable");
    expect(record.retryable).toBe(true);
  });

  it("never persists a secret into the sanitized record's message", () => {
    const record = sanitizeIntegrationError({ connectionId: "conn_1", providerId: "gmail", rawMessage: "auth failed with Bearer ya29.superSecretTokenValueHere", statusCode: 401 });
    expect(record.message).not.toContain("ya29.superSecretTokenValueHere");
  });

  it("truncates an overlong message rather than storing it whole", () => {
    const record = sanitizeIntegrationError({ connectionId: "conn_1", providerId: "gmail", rawMessage: "x".repeat(1000) });
    expect(record.message.length).toBeLessThanOrEqual(500);
  });
});
