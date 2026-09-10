import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import {
  issueApiKeyCredential,
  issueOAuthCredential,
  issueProviderSecretCredential,
  resolveAccessToken,
  resolveProviderSecret,
  resolveRefreshToken,
  rotateOAuthCredential,
  rotateProviderSecretCredential,
  verifyApiKeySecret,
  rotateApiKeyCredential,
  revokeCredential,
  getCredentialForConnection,
  listCredentials,
  resetEncryptionProvider,
} from "@/core/integrations/credentialManager";

beforeEach(() => {
  resetCredentialStore();
  resetEncryptionProvider();
});

describe("issueApiKeyCredential", () => {
  it("never persists the plaintext secret, only a hash and a display prefix", async () => {
    const { credential, secret } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_1", scopes: ["crm.read"], createdBy: "user_1" });
    expect(secret.startsWith("bloom_sk_")).toBe(true);
    expect(credential.key_hash).not.toBeNull();
    expect(credential.key_hash).not.toBe(secret);
    expect(credential.key_prefix).toBe(secret.slice(0, 12));
    expect(credential.kind).toBe("api_key");
  });

  it("verifies the presented secret against the stored hash", async () => {
    const { secret } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_1", scopes: [], createdBy: "user_1" });
    await expect(verifyApiKeySecret("conn_1", secret)).resolves.toBe(true);
    await expect(verifyApiKeySecret("conn_1", "bloom_sk_wrong")).resolves.toBe(false);
  });
});

describe("issueOAuthCredential", () => {
  it("never stores the raw token — only an opaque ref resolvable through the EncryptionProvider", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_2", scopes: ["crm.read"], createdBy: "user_1", accessToken: "raw-token-value" });
    expect(credential.access_token_ref).not.toBeNull();
    expect(credential.access_token_ref).not.toBe("raw-token-value");
    await expect(resolveAccessToken(credential.id)).resolves.toBe("raw-token-value");
  });

  it("returns null once the credential is revoked", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_3", scopes: [], createdBy: "user_1", accessToken: "raw" });
    await revokeCredential(credential.id);
    await expect(resolveAccessToken(credential.id)).resolves.toBeNull();
  });
});

describe("rotateApiKeyCredential", () => {
  it("issues a fresh secret and invalidates the old one", async () => {
    const { credential, secret: oldSecret } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_4", scopes: [], createdBy: "user_1" });
    const rotated = await rotateApiKeyCredential(credential.id);
    expect(rotated).not.toBeNull();
    expect(rotated!.secret).not.toBe(oldSecret);
    await expect(verifyApiKeySecret("conn_4", oldSecret)).resolves.toBe(false);
    await expect(verifyApiKeySecret("conn_4", rotated!.secret)).resolves.toBe(true);
  });
});

describe("issueProviderSecretCredential", () => {
  it("never stores the raw secret — only an opaque ref resolvable through the EncryptionProvider", async () => {
    const credential = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: "conn_7", createdBy: "user_1", secret: "sk_test_abc123" });
    expect(credential.kind).toBe("provider_secret");
    expect(credential.access_token_ref).not.toBeNull();
    expect(credential.access_token_ref).not.toBe("sk_test_abc123");
    await expect(resolveProviderSecret(credential.id)).resolves.toBe("sk_test_abc123");
  });

  it("returns null once revoked, and resolveProviderSecret never resolves an oauth_token-kind credential", async () => {
    const providerSecret = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: "conn_8", createdBy: "user_1", secret: "sk_test_xyz" });
    await revokeCredential(providerSecret.id);
    await expect(resolveProviderSecret(providerSecret.id)).resolves.toBeNull();

    const oauthCredential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_9", scopes: [], createdBy: "user_1", accessToken: "raw" });
    await expect(resolveProviderSecret(oauthCredential.id)).resolves.toBeNull();
  });
});

describe("rotateProviderSecretCredential", () => {
  it("replaces the encrypted value in place, keeping the same credential id", async () => {
    const credential = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: "conn_10", createdBy: "user_1", secret: "sk_test_old" });
    const rotated = await rotateProviderSecretCredential(credential.id, "sk_test_new");
    expect(rotated?.id).toBe(credential.id);
    expect(rotated?.rotated_at).not.toBeNull();
    await expect(resolveProviderSecret(credential.id)).resolves.toBe("sk_test_new");
  });
});

describe("listCredentials / getCredentialForConnection", () => {
  it("scopes listCredentials to the workspace and resolves a credential by connection id", async () => {
    await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_5", scopes: [], createdBy: "user_1" });
    await issueApiKeyCredential({ workspaceId: "ws_2", connectionId: "conn_6", scopes: [], createdBy: "user_1" });
    expect(await listCredentials("ws_1")).toHaveLength(1);
    expect(await getCredentialForConnection("conn_5")).not.toBeNull();
    expect(await getCredentialForConnection("conn_nonexistent")).toBeNull();
  });
});

describe("GMAIL-02 — member_id ownership threading", () => {
  it("defaults every credential kind to member_id: null (workspace-owned), matching every provider's existing shape", async () => {
    const { credential: apiKey } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_20", scopes: [], createdBy: "user_1" });
    const oauth = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_21", scopes: [], createdBy: "user_1", accessToken: "tok" });
    const providerSecret = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: "conn_22", createdBy: "user_1", secret: "sk_test_x" });
    expect(apiKey.member_id).toBeNull();
    expect(oauth.member_id).toBeNull();
    expect(providerSecret.member_id).toBeNull();
  });

  it("issues a member-owned oauth_token credential when memberId is supplied — the shape a Gmail connection needs", async () => {
    const credential = await issueOAuthCredential({
      workspaceId: "ws_1",
      connectionId: "conn_23",
      scopes: ["gmail.readonly"],
      createdBy: "user_1",
      accessToken: "gmail_tok",
      memberId: "user_2",
    });
    expect(credential.member_id).toBe("user_2");
    expect(credential.workspace_id).toBe("ws_1");
  });
});

describe("resolveRefreshToken (GMAIL-03R2)", () => {
  it("resolves the real refresh token for an oauth_token credential", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_30", scopes: [], createdBy: "user_1", accessToken: "access", refreshToken: "refresh-value" });
    await expect(resolveRefreshToken(credential.id)).resolves.toBe("refresh-value");
  });

  it("returns null when the credential has no refresh token", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_31", scopes: [], createdBy: "user_1", accessToken: "access" });
    await expect(resolveRefreshToken(credential.id)).resolves.toBeNull();
  });

  it("returns null for a non-oauth_token credential kind, never resolving an api_key/provider_secret's own ref as if it were a refresh token", async () => {
    const { credential } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_32", scopes: [], createdBy: "user_1" });
    await expect(resolveRefreshToken(credential.id)).resolves.toBeNull();
  });

  it("returns null once the credential is revoked", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_33", scopes: [], createdBy: "user_1", accessToken: "access", refreshToken: "refresh-value" });
    await revokeCredential(credential.id);
    await expect(resolveRefreshToken(credential.id)).resolves.toBeNull();
  });
});

describe("rotateOAuthCredential (GMAIL-03R2)", () => {
  it("replaces the access token and, when supplied, the refresh token — same credential id", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_40", scopes: [], createdBy: "user_1", accessToken: "old-access", refreshToken: "old-refresh" });
    const rotated = await rotateOAuthCredential(credential.id, { accessToken: "new-access", refreshToken: "new-refresh", expiresAt: "2026-02-01T00:00:00.000Z" });

    expect(rotated?.id).toBe(credential.id);
    expect(rotated?.rotated_at).not.toBeNull();
    expect(rotated?.expires_at).toBe("2026-02-01T00:00:00.000Z");
    await expect(resolveAccessToken(credential.id)).resolves.toBe("new-access");
    await expect(resolveRefreshToken(credential.id)).resolves.toBe("new-refresh");
  });

  it("preserves the existing refresh token when the caller omits a replacement — Google's own 'no refresh_token in the response' case", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_41", scopes: [], createdBy: "user_1", accessToken: "old-access", refreshToken: "old-refresh" });
    const rotated = await rotateOAuthCredential(credential.id, { accessToken: "new-access" });

    expect(rotated).not.toBeNull();
    await expect(resolveAccessToken(credential.id)).resolves.toBe("new-access");
    await expect(resolveRefreshToken(credential.id)).resolves.toBe("old-refresh");
  });

  it("also preserves the existing refresh token when the caller explicitly passes null, not just undefined", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_42", scopes: [], createdBy: "user_1", accessToken: "old-access", refreshToken: "old-refresh" });
    await rotateOAuthCredential(credential.id, { accessToken: "new-access", refreshToken: null });
    await expect(resolveRefreshToken(credential.id)).resolves.toBe("old-refresh");
  });

  it("returns null for a non-oauth_token credential kind, never rotating an api_key/provider_secret as if it held a token pair", async () => {
    const { credential } = await issueApiKeyCredential({ workspaceId: "ws_1", connectionId: "conn_43", scopes: [], createdBy: "user_1" });
    const rotated = await rotateOAuthCredential(credential.id, { accessToken: "new-access" });
    expect(rotated).toBeNull();
  });

  it("preserves member_id ownership across rotation", async () => {
    const credential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: "conn_44", scopes: [], createdBy: "user_1", accessToken: "old", memberId: "user_2" });
    const rotated = await rotateOAuthCredential(credential.id, { accessToken: "new-access" });
    expect(rotated?.member_id).toBe("user_2");
  });
});
