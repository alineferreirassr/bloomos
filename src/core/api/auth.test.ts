import { afterEach, describe, expect, it } from "vitest";
import { resolveApiAuth } from "@/core/api/auth";
import { createApiKey, revokeApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";

function requestWithAuth(header?: string): Request {
  return new Request("http://localhost/api/v1/clients", { headers: header ? { authorization: header } : {} });
}

afterEach(() => {
  resetApiKeyStore();
});

describe("resolveApiAuth", () => {
  it("rejects a request with no Authorization header", async () => {
    const result = await resolveApiAuth(requestWithAuth());
    expect(result.kind).toBe("error");
  });

  it("rejects a header that isn't a Bearer token", async () => {
    const result = await resolveApiAuth(requestWithAuth("Basic dXNlcjpwYXNz"));
    expect(result.kind).toBe("error");
  });

  it("rejects an empty Bearer secret", async () => {
    const result = await resolveApiAuth(requestWithAuth("Bearer "));
    expect(result.kind).toBe("error");
  });

  it("rejects a well-formed but unknown secret", async () => {
    const result = await resolveApiAuth(requestWithAuth("Bearer bloom_sk_totally_made_up"));
    expect(result.kind).toBe("error");
  });

  it("accepts a valid secret and resolves the auth context", async () => {
    const { key, secret } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read", "finance.read"] });
    const result = await resolveApiAuth(requestWithAuth(`Bearer ${secret}`));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.auth).toEqual({ apiKeyId: key.id, workspaceId: "ws_1", scopes: ["crm.read", "finance.read"] });
    }
  });

  it("rejects a revoked key's secret, even though the hash still matches", async () => {
    const { key, secret } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    revokeApiKey(key.id);
    const result = await resolveApiAuth(requestWithAuth(`Bearer ${secret}`));
    expect(result.kind).toBe("error");
  });

  it("never leaks whether the failure was 'no such key' vs 'revoked' vs 'malformed header' — always the same generic message", async () => {
    const noHeader = await resolveApiAuth(requestWithAuth());
    const unknownSecret = await resolveApiAuth(requestWithAuth("Bearer bloom_sk_unknown"));
    expect(noHeader.kind).toBe("error");
    expect(unknownSecret.kind).toBe("error");
    if (noHeader.kind === "error" && unknownSecret.kind === "error") {
      expect(noHeader.message).toEqual(unknownSecret.message);
    }
  });
});
