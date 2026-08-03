import { describe, expect, it } from "vitest";
import { generateInvitationToken, hashInvitationToken } from "@/lib/team/invitationToken";

describe("generateInvitationToken", () => {
  it("generates a URL-safe, non-empty token", () => {
    const token = generateInvitationToken();
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a different token on every call", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toBe(b);
  });
});

describe("hashInvitationToken", () => {
  it("is deterministic for the same input", async () => {
    const token = generateInvitationToken();
    expect(await hashInvitationToken(token)).toBe(await hashInvitationToken(token));
  });

  it("differs for different inputs", async () => {
    const a = await hashInvitationToken("token-a");
    const b = await hashInvitationToken("token-b");
    expect(a).not.toBe(b);
  });

  it("produces a lowercase 64-character hex string (SHA-256)", async () => {
    const hash = await hashInvitationToken("some-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
