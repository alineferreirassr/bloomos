import { beforeEach, describe, expect, it } from "vitest";
import { resetProviderRegistry, registerProvider } from "@/core/integrations/providerRegistry";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider } from "@/core/integrations/credentialManager";
import { beginAuthorization, cancelAuthorization, completeAuthorization, getPendingAuthorization, resetOAuthEngine } from "@/core/integrations/oauthEngine";
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
});

describe("beginAuthorization", () => {
  it("builds a real authorization URL with state and PKCE challenge, never fetching it", async () => {
    const result = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe("https://example.test/oauth/authorize");
    expect(url.searchParams.get("state")).toBe(result.state);
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(getPendingAuthorization(result.state)).not.toBeNull();
  });

  it("throws for a provider with no OAuth metadata", async () => {
    await expect(beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "no-oauth", redirectUri: "https://app.test/callback" })).rejects.toThrow(/does not declare OAuth support/);
  });

  it("throws for an unregistered provider", async () => {
    await expect(beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "missing", redirectUri: "https://app.test/callback" })).rejects.toThrow(/No provider is registered/);
  });
});

describe("completeAuthorization", () => {
  it("consumes the pending authorization exactly once and issues a credential", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    const result = await completeAuthorization({ state, createdBy: "user_1", accessToken: "synthetic-token" });
    expect(result.connectionId).toBe("conn_1");
    expect(result.providerId).toBe("test-oauth-provider");
    expect(result.credential.kind).toBe("oauth_token");
    expect(getPendingAuthorization(state)).toBeNull();

    await expect(completeAuthorization({ state, createdBy: "user_1", accessToken: "replayed" })).rejects.toThrow(/No pending authorization/);
  });
});

describe("cancelAuthorization", () => {
  it("discards a pending authorization without issuing a credential", async () => {
    const { state } = await beginAuthorization({ workspaceId: "ws_1", connectionId: "conn_1", providerId: "test-oauth-provider", redirectUri: "https://app.test/callback" });
    cancelAuthorization(state);
    expect(getPendingAuthorization(state)).toBeNull();
  });
});
