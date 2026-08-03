import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/core/api/rateLimit";

describe("checkRateLimit", () => {
  it("always allows today — the policy is a deferred future seam, not yet a working limiter", async () => {
    expect(await checkRateLimit("any-key-id")).toEqual({ allowed: true });
  });
});
