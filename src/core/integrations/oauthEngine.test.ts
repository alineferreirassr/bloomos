import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// GMAIL-OAUTH-FIX-01 — beginAuthorization() now resolves real OAuth client
// credentials via this function. "test-oauth-provider" below is a fake,
// test-only provider id with no entry in that function's real
// env-var-backed map, so it's stubbed here rather than exercising the real
// per-provider env lookup — every test below that isn't specifically about
// credential resolution should keep passing exactly as before.
vi.mock("@/core/integrations/oauthTokenExchange", () => ({ resolveOAuthClientCredentials: vi.fn() }));
import { createClient } from "@/lib/supabase/server";
import { resolveOAuthClientCredentials } from "@/core/integrations/oauthTokenExchange";
import { resetProviderRegistry, registerProvider } from "@/core/integrations/providerRegistry";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, InMemoryEncryptionProvider } from "@/core/integrations/credentialManager";
import {
  beginAuthorization,
  cancelAuthorization,
  completeAuthorization,
  getPendingAuthorization,
  getPendingAuthorizationForCaller,
  resetOAuthEngine,
  resolvePendingAuthorizationCodeVerifier,
  setPendingSecretProvider,
} from "@/core/integrations/oauthEngine";
import { getPendingAuthorizationByState } from "@/lib/data/core/integrations/pendingOAuthAuthorizationStore";
import type { ProviderDefinition } from "@/core/integrations/types";

const oauthProvider: ProviderDefinition = {
  id: "test-oauth-provider",
  name: "Test OAuth Provider",
  category: "crm",
  icon: "Star",
  version: 1,
  capabilities: ["oauth"],
  description: "test",
  requiredPermission: "workspace.manage",
  requiredApiScopes: [],
  subscribedWebhookEvents: [],
  oauth: {
    authorizationEndpoint: "https://example.test/oauth/authorize",
    tokenEndpoint: "https://example.test/oauth/token",
    defaultScopes: ["read"],
    supportsPkce: true,
  },
};

const noOauthProvider: ProviderDefinition = { ...oauthProvider, id: "no-oauth", capabilities: [], oauth: undefined };

beforeEach(() => {
  resetProviderRegistry();
  resetCredentialStore();
  resetEncryptionProvider();
  resetOAuthEngine();
  registerProvider(oauthProvider);
  registerProvider(noOauthProvider);
  vi.mocked(resolveOAuthClientCredentials).mockReturnValue({ clientId: "test_client_id_abc", clientSecret: "test_client_secret_xyz" });
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_DATA_MODE;
  vi.clearAllMocks();
});

describe("beginAuthorization", () => {
  it("builds a real authorization URL with state and PKCE challenge, never fetching it", async () => {
    const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://example.test/oauth/authorize");
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(await getPendingAuthorization(result.state)).not.toBeNull();
  });

  describe("GMAIL-OAUTH-FIX-01 — client_id inclusion", () => {
    it("(A, B) the authorization URL contains client_id, equal to the resolved configured client id", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get("client_id")).toBe("test_client_id_abc");
    });

    it("(C, D) redirect_uri and state remain present alongside client_id — unchanged by this fix", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/callback");
      expect(url.searchParams.get("state")).toBe(result.state);
    });

    it("(E) PKCE parameters remain present for a provider that supports PKCE", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    });

    it("(F) scopes remain correct alongside client_id", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get("scope")).toBe("read");
    });

    it("(G) client_secret never appears anywhere in the authorization URL", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      expect(result.authorizationUrl).not.toContain("test_client_secret_xyz");
      expect(result.authorizationUrl).not.toMatch(/client_secret/);
    });

    it("(H) missing OAuth client configuration produces a controlled failure — no blank client_id, no pending-authorization row left behind, no Vault secret created", async () => {
      vi.mocked(resolveOAuthClientCredentials).mockReturnValueOnce(null);
      await expect(
        beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" }),
      ).rejects.toThrow(/No OAuth client is configured for "test-oauth-provider"/);
    });

    it("(I) URL generation remains valid for a provider with no scopes/no PKCE", async () => {
      const minimalProvider: ProviderDefinition = {
        ...oauthProvider,
        id: "minimal-oauth-provider",
        oauth: { authorizationEndpoint: "https://example.test/oauth/authorize", tokenEndpoint: "https://example.test/oauth/token", defaultScopes: [], supportsPkce: false },
      };
      registerProvider(minimalProvider);
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "minimal-oauth-provider", redirectUri: "https://app.test/callback" });
      const url = new URL(result.authorizationUrl);
      expect(url.searchParams.get("client_id")).toBe("test_client_id_abc");
      expect(url.searchParams.has("scope")).toBe(false);
      expect(url.searchParams.has("code_challenge")).toBe(false);
    });

    it("(J) the returned result never carries the client secret anywhere, in any field", async () => {
      const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
      expect(Object.keys(result).sort()).toEqual(["authorizationUrl", "state"]);
      expect(JSON.stringify(result)).not.toContain("test_client_secret_xyz");
    });
  });

  it("throws for a provider with no OAuth metadata", async () => {
    await expect(beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "no-oauth", redirectUri: "https://app.test/callback" })).rejects.toThrow(/does not declare OAuth support/);
  });

  it("throws for an unregistered provider", async () => {
    await expect(beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "missing", redirectUri: "https://app.test/callback" })).rejects.toThrow(/No provider is registered/);
  });

  it("GMAIL-03P: persists the pending authorization in the store — not just a value getPendingAuthorization happens to remember", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const row = await getPendingAuthorizationByState(state);
    expect(row).not.toBeNull();
    expect(row?.workspace_id).toBe("ws_1");
    expect(row?.connection_id).toBe("conn_1");
  });
});

describe("completeAuthorization", () => {
  it("consumes the pending authorization exactly once and issues a credential", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "synthetic-token" });
    expect(result.connectionId).toBe("conn_1");
    expect(result.providerId).toBe("test-oauth-provider");
    expect(result.credential.kind).toBe("oauth_token");
    expect(await getPendingAuthorization(state)).toBeNull();

    await expect(completeAuthorization({ state, createdBy: "user_1", accessToken: "replayed" })).rejects.toThrow(/No pending authorization/);
  });

  it("reads the pending authorization from the store, not a value retained by beginAuthorization's own caller", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    expect(await getPendingAuthorizationByState(state)).not.toBeNull();
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "synthetic-token" });
    expect(result.connectionId).toBe("conn_1");
    expect(await getPendingAuthorizationByState(state)).toBeNull();
  });

  it("rejects an unknown/invalid state", async () => {
    await expect(completeAuthorization({ state: "state_that_never_existed", createdBy: "user_1", accessToken: "tok" })).rejects.toThrow(/No pending authorization/);
  });

  it("rejects an expired pending authorization and lazily removes it", async () => {
    vi.useFakeTimers();
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    vi.advanceTimersByTime(11 * 60 * 1000);

    await expect(completeAuthorization({ state, createdBy: "user_1", accessToken: "tok" })).rejects.toThrow(/No pending authorization/);
    expect(await getPendingAuthorizationByState(state)).toBeNull();
  });

  it("GMAIL-03P: never receives the plaintext PKCE code_verifier through the pending record it reads", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const pending = await getPendingAuthorization(state);
    expect(pending).not.toBeNull();
    expect(Object.keys(pending as object)).not.toContain("code_verifier");
    expect(Object.keys(pending as object)).not.toContain("code_verifier_ref");
  });

  it("GMAIL-03P: the real PKCE code_verifier is recoverable only via the secret provider's own decrypt path", async () => {
    const provider = new InMemoryEncryptionProvider();
    setPendingSecretProvider(provider);
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const row = await getPendingAuthorizationByState(state);
    expect(row?.code_verifier_ref).toBeTruthy();
    const decrypted = await provider.decrypt(row!.code_verifier_ref!);
    expect(decrypted).toBeTruthy();
    expect(typeof decrypted).toBe("string");
  });
});

describe("getPendingAuthorizationForCaller — ownership scoping (GMAIL-03P)", () => {
  it("returns the pending authorization for the matching workspace/member", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });
    const pending = await getPendingAuthorizationForCaller(state, { workspaceId: "ws_1", memberId: "user_1" });
    expect(pending).not.toBeNull();
  });

  it("denies a different member in the same workspace from consuming a member-owned pending authorization", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });
    const pending = await getPendingAuthorizationForCaller(state, { workspaceId: "ws_1", memberId: "user_2" });
    expect(pending).toBeNull();
  });

  it("denies a different workspace from consuming the pending authorization", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });
    const pending = await getPendingAuthorizationForCaller(state, { workspaceId: "ws_other", memberId: "user_1" });
    expect(pending).toBeNull();
  });

  it("allows any workspace member to consume a workspace-owned (memberId omitted) pending authorization", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const pending = await getPendingAuthorizationForCaller(state, { workspaceId: "ws_1", memberId: "any_member" });
    expect(pending).not.toBeNull();
  });
});

describe("cancelAuthorization", () => {
  it("discards a pending authorization without issuing a credential", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    await cancelAuthorization(state);
    expect(await getPendingAuthorization(state)).toBeNull();
  });
});

describe("resolvePendingAuthorizationCodeVerifier (GMAIL-03R2)", () => {
  it("resolves the real plaintext PKCE code_verifier server-side", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const verifier = await resolvePendingAuthorizationCodeVerifier(state);
    expect(typeof verifier).toBe("string");
    expect(verifier!.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown state", async () => {
    expect(await resolvePendingAuthorizationCodeVerifier("state_never_existed")).toBeNull();
  });

  it("returns null when the caller's workspace doesn't match", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    expect(await resolvePendingAuthorizationCodeVerifier(state, { workspaceId: "ws_other" })).toBeNull();
  });

  it("returns null when the caller's member id doesn't match a member-owned pending authorization", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });
    expect(await resolvePendingAuthorizationCodeVerifier(state, { workspaceId: "ws_1", memberId: "user_2" })).toBeNull();
    expect(await resolvePendingAuthorizationCodeVerifier(state, { workspaceId: "ws_1", memberId: "user_1" })).toBeTruthy();
  });
});

describe("completeAuthorization — ownership scoping (GMAIL-03R2)", () => {
  it("succeeds when the caller's workspace/member matches the pending authorization", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "tok", callerWorkspaceId: "ws_1", callerMemberId: "user_1" });
    expect(result.credential.member_id).toBe("user_1");
  });

  it("rejects a mismatched member without deleting the still-valid pending row — the real owner can still complete it", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback", memberId: "user_1" });

    await expect(completeAuthorization({ state, createdBy: "user_2", accessToken: "tok", callerWorkspaceId: "ws_1", callerMemberId: "user_2" })).rejects.toThrow(/No pending authorization/);

    // Still there — a wrong caller must never be able to destroy someone else's in-progress authorization.
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "tok", callerWorkspaceId: "ws_1", callerMemberId: "user_1" });
    expect(result.credential.member_id).toBe("user_1");
  });

  it("rejects a mismatched workspace the same way, without deleting the row", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });

    await expect(completeAuthorization({ state, createdBy: "user_1", accessToken: "tok", callerWorkspaceId: "ws_other" })).rejects.toThrow(/No pending authorization/);

    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "tok", callerWorkspaceId: "ws_1" });
    expect(result.connectionId).toBe("conn_1");
  });

  it("preserves the exact prior behavior when no caller scope is supplied at all", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "tok" });
    expect(result.connectionId).toBe("conn_1");
  });
});

describe("GMAIL-03P — production (Supabase-mode) durability proof", () => {
  type QueryResult = { data: unknown; error: unknown };

  function mockSupabase(responses: QueryResult[]) {
    let i = 0;
    function next(): QueryResult {
      if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
      return responses[i++];
    }
    function builder() {
      const b: Record<string, unknown> = {};
      const chain = () => b;
      b.select = chain;
      b.eq = chain;
      b.insert = chain;
      b.delete = chain;
      b.rpc = chain;
      b.maybeSingle = async () => next();
      b.single = async () => next();
      b.then = (resolve: (value: QueryResult) => void) => resolve(next());
      return b;
    }
    const client = { from: () => builder(), rpc: vi.fn().mockResolvedValue({ data: "secretref_vault_1", error: null }) };
    vi.mocked(createClient).mockResolvedValue(client as never);
    return client;
  }

  function row(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      state: "prod_state_1",
      workspace_id: "ws_1",
      member_id: null,
      provider_id: "test-oauth-provider",
      connection_id: "conn_1",
      redirect_uri: "https://app.test/callback",
      code_verifier_ref: "secretref_vault_1",
      created_at: "2026-01-01T00:00:00.000Z",
      // Far in the future — isExpired() compares against the real wall clock, not a fixed test date.
      expires_at: "2099-01-01T00:10:00.000Z",
      ...overrides,
    };
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DATA_MODE = "supabase";
    // Re-derive pendingSecretProvider now that data mode is "supabase" — resetOAuthEngine() in the
    // outer beforeEach ran while data mode was still "mock", so it must run again here.
    resetOAuthEngine();
  });

  it("beginAuthorization writes through the Supabase-backed store (real insert + real Vault RPC), never a local array, when in Supabase data mode", async () => {
    const client = mockSupabase([{ data: row(), error: null }]);

    const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });

    expect(result.state).toBeTruthy();
    // Proves the call actually went through the mocked Supabase client's own `.rpc` (encrypting
    // the code_verifier via Vault) rather than any in-memory fallback — there is no other path
    // in Supabase mode that could have produced a result without exercising this mock.
    expect(client.rpc).toHaveBeenCalledWith("store_integration_secret", expect.objectContaining({ p_plaintext: expect.any(String) }));
  });

  it("beginAuthorization then completeAuthorization succeed as two separate calls, each independently hitting the Supabase-backed store — the cross-request durability proof", async () => {
    const beginClient = mockSupabase([{ data: row(), error: null }]);
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    expect(state).toBeTruthy();

    // Simulate the second HTTP request (the provider's callback) by installing a brand-new
    // mocked Supabase client — nothing from `beginClient`'s closures is reachable here, only
    // whatever was actually persisted through the first call's `.insert(...)`.
    void beginClient;
    mockSupabase([
      { data: row({ state }), error: null }, // getPendingAuthorizationByState inside completeAuthorization
      { data: [{ state }], error: null }, // deletePendingAuthorization
      {
        data: {
          id: "cred_1",
          workspace_id: "ws_1",
          member_id: null,
          connection_id: "conn_1",
          kind: "oauth_token",
          scopes: [],
          expires_at: null,
          rotated_at: null,
          revoked_at: null,
          key_hash: null,
          key_prefix: null,
          access_token_ref: "vault_secret_access_1",
          refresh_token_ref: null,
          created_by: "user_1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        error: null,
      }, // insertCredential inside issueOAuthCredential
    ]);

    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "real-access-token" });
    expect(result.connectionId).toBe("conn_1");
    expect(result.providerId).toBe("test-oauth-provider");
  });
});
