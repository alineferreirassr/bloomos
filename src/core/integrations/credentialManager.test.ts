import { beforeEach, describe, expect, it } from "vitest";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import {
  issueApiKeyCredential,
  issueOAuthCredential,
  issueProviderSecretCredential,
  resolveAccessToken,
  resolveProviderSecret,
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
    revokeCredential(credential.id);
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
    revokeCredential(providerSecret.id);
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
    expect(listCredentials("ws_1")).toHaveLength(1);
    expect(getCredentialForConnection("conn_5")).not.toBeNull();
    expect(getCredentialForConnection("conn_nonexistent")).toBeNull();
  });
});
