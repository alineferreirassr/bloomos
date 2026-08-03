import { describe, expect, it, vi } from "vitest";
import { computeBackoffDelayMs, executeWithRetry } from "@/core/integrations/retryEngine";
import { DEFAULT_RETRY_POLICY } from "@/core/integrations/types";

describe("computeBackoffDelayMs", () => {
  it("doubles the delay each attempt, starting from the policy's base delay", () => {
    expect(computeBackoffDelayMs(1, DEFAULT_RETRY_POLICY)).toBe(1000);
    expect(computeBackoffDelayMs(2, DEFAULT_RETRY_POLICY)).toBe(2000);
    expect(computeBackoffDelayMs(3, DEFAULT_RETRY_POLICY)).toBe(4000);
    expect(computeBackoffDelayMs(4, DEFAULT_RETRY_POLICY)).toBe(8000);
  });

  it("caps at the policy's max delay", () => {
    expect(computeBackoffDelayMs(10, DEFAULT_RETRY_POLICY)).toBe(60_000);
  });

  it("matches Webhooks' own exact sequence (1s base, 60s cap) — the retrofit must be byte-for-byte identical", () => {
    const webhookPolicy = { baseDelayMs: 1000, maxDelayMs: 60_000, maxAttempts: 5, jitter: false };
    expect([1, 2, 3, 4, 5].map((attempt) => computeBackoffDelayMs(attempt, webhookPolicy))).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("adds jitter within ±20% when the policy enables it", () => {
    const policy = { baseDelayMs: 1000, maxDelayMs: 60_000, maxAttempts: 5, jitter: true };
    for (let i = 0; i < 20; i++) {
      const delayMs = computeBackoffDelayMs(1, policy);
      expect(delayMs).toBeGreaterThanOrEqual(800);
      expect(delayMs).toBeLessThanOrEqual(1200);
    }
  });
});

describe("executeWithRetry", () => {
  it("returns success on the first attempt with a single attempt record", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await executeWithRetry(fn, DEFAULT_RETRY_POLICY);
    expect(result.succeeded).toBe(true);
    expect(result.result).toBe("ok");
    expect(result.attempts).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on a later attempt", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("first fails")).mockResolvedValueOnce("recovered");
    const result = await executeWithRetry(fn, DEFAULT_RETRY_POLICY);
    expect(result.succeeded).toBe(true);
    expect(result.result).toBe("recovered");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0].succeeded).toBe(false);
    expect(result.attempts[0].delayMs).toBe(1000);
    expect(result.attempts[1].succeeded).toBe(true);
  });

  it("exhausts every attempt and returns the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    const policy = { baseDelayMs: 10, maxDelayMs: 100, maxAttempts: 3, jitter: false };
    const result = await executeWithRetry(fn, policy);
    expect(result.succeeded).toBe(false);
    expect(result.error).toBe("always fails");
    expect(result.attempts).toHaveLength(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result.attempts[2].delayMs).toBeNull();
  });

  it("handles a thrown non-Error value with a safe generic message", async () => {
    const fn = vi.fn().mockRejectedValue("a raw string throw");
    const policy = { baseDelayMs: 10, maxDelayMs: 100, maxAttempts: 1, jitter: false };
    const result = await executeWithRetry(fn, policy);
    expect(result.succeeded).toBe(false);
    expect(result.error).toBe("Unknown error");
  });
});
