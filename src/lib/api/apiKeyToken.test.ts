import { describe, expect, it } from "vitest";
import { generateApiKeySecret, hashApiKeySecret, displayPrefix } from "@/lib/api/apiKeyToken";

describe("apiKeyToken", () => {
  it("generates a secret prefixed with bloom_sk_ and enough entropy to be unique across calls", () => {
    const a = generateApiKeySecret();
    const b = generateApiKeySecret();
    expect(a.startsWith("bloom_sk_")).toBe(true);
    expect(a).not.toEqual(b);
  });

  it("hashes deterministically — the same secret always produces the same hash", async () => {
    const secret = generateApiKeySecret();
    const hashA = await hashApiKeySecret(secret);
    const hashB = await hashApiKeySecret(secret);
    expect(hashA).toEqual(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes two different secrets to two different digests", async () => {
    const hashA = await hashApiKeySecret(generateApiKeySecret());
    const hashB = await hashApiKeySecret(generateApiKeySecret());
    expect(hashA).not.toEqual(hashB);
  });

  it("displayPrefix returns only the first 12 characters — never enough to reconstruct the secret", () => {
    const secret = generateApiKeySecret();
    const prefix = displayPrefix(secret);
    expect(prefix).toHaveLength(12);
    expect(secret.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(secret.length);
  });
});
