import { afterEach, describe, expect, it } from "vitest";
import { getClaimLeaseMs, MAX_PUBLISH_ATTEMPTS, SOCIAL_RETRY_POLICY } from "@/core/social/socialSchedulingPolicy";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getClaimLeaseMs", () => {
  it("defaults to 600 seconds when unset", () => {
    delete process.env.SOCIAL_SCHEDULER_LEASE_SECONDS;
    expect(getClaimLeaseMs()).toBe(600_000);
  });

  it("honors a valid positive override", () => {
    process.env.SOCIAL_SCHEDULER_LEASE_SECONDS = "120";
    expect(getClaimLeaseMs()).toBe(120_000);
  });

  it("falls back to the default for an invalid value, never throwing", () => {
    process.env.SOCIAL_SCHEDULER_LEASE_SECONDS = "not-a-number";
    expect(getClaimLeaseMs()).toBe(600_000);
  });

  it("falls back to the default for a zero or negative value", () => {
    process.env.SOCIAL_SCHEDULER_LEASE_SECONDS = "-5";
    expect(getClaimLeaseMs()).toBe(600_000);
  });
});

describe("MAX_PUBLISH_ATTEMPTS / SOCIAL_RETRY_POLICY", () => {
  it("is the founder-decided value of 3, kept consistent with claim_due_social_posts()'s own hardcoded limit", () => {
    expect(MAX_PUBLISH_ATTEMPTS).toBe(3);
    expect(SOCIAL_RETRY_POLICY.maxAttempts).toBe(3);
  });

  it("uses the same base/max backoff delays as every other retrying subsystem in this codebase", () => {
    expect(SOCIAL_RETRY_POLICY.baseDelayMs).toBe(1000);
    expect(SOCIAL_RETRY_POLICY.maxDelayMs).toBe(60_000);
    expect(SOCIAL_RETRY_POLICY.jitter).toBe(false);
  });
});
