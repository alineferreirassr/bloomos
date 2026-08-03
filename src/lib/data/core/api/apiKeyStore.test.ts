import { afterEach, describe, expect, it } from "vitest";
import {
  createApiKey,
  listApiKeysForWorkspace,
  getApiKeyById,
  getApiKeyByHash,
  touchApiKeyLastUsed,
  rotateApiKey,
  revokeApiKey,
  seedDemoApiKey,
  resetApiKeyStore,
  DEMO_API_KEY_SECRET,
} from "@/lib/data/core/api/apiKeyStore";
import { hashApiKeySecret } from "@/lib/api/apiKeyToken";

afterEach(() => {
  resetApiKeyStore();
});

describe("apiKeyStore", () => {
  it("creates a key, returning the record and its one-time secret — the secret is never stored on the record itself", async () => {
    const { key, secret } = await createApiKey("ws_1", "member_1", { name: "Zapier", scopes: ["crm.read"] });
    expect(key.workspace_id).toBe("ws_1");
    expect(key.name).toBe("Zapier");
    expect(key.scopes).toEqual(["crm.read"]);
    expect(key.revoked_at).toBeNull();
    expect(secret.startsWith("bloom_sk_")).toBe(true);
    expect(JSON.stringify(key)).not.toContain(secret);
  });

  it("looks a key up by the hash of its secret, matching what an incoming request presents", async () => {
    const { key, secret } = await createApiKey("ws_1", "member_1", { name: "Zapier", scopes: ["crm.read"] });
    const hash = await hashApiKeySecret(secret);
    expect(getApiKeyByHash(hash)?.id).toBe(key.id);
    expect(getApiKeyByHash("not-a-real-hash")).toBeNull();
  });

  it("scopes listing strictly to one workspace", async () => {
    await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    await createApiKey("ws_2", "member_1", { name: "B", scopes: ["crm.read"] });
    expect(listApiKeysForWorkspace("ws_1")).toHaveLength(1);
    expect(listApiKeysForWorkspace("ws_2")).toHaveLength(1);
  });

  it("touchApiKeyLastUsed sets last_used_at without disturbing any other field", async () => {
    const { key } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    expect(key.last_used_at).toBeNull();
    touchApiKeyLastUsed(key.id);
    expect(getApiKeyById(key.id)?.last_used_at).not.toBeNull();
  });

  it("rotate replaces the hash/prefix in place, invalidating the old secret while preserving id/name/scopes", async () => {
    const { key, secret } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    const rotated = await rotateApiKey(key.id);
    expect(rotated).not.toBeNull();
    expect(rotated?.key.id).toBe(key.id);
    expect(rotated?.key.name).toBe("A");
    expect(rotated?.secret).not.toEqual(secret);
    expect(rotated?.key.rotated_at).not.toBeNull();

    const oldHash = await hashApiKeySecret(secret);
    const newHash = await hashApiKeySecret(rotated!.secret);
    expect(getApiKeyByHash(oldHash)).toBeNull();
    expect(getApiKeyByHash(newHash)?.id).toBe(key.id);
  });

  it("rotate refuses a revoked key", async () => {
    const { key } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    revokeApiKey(key.id);
    expect(await rotateApiKey(key.id)).toBeNull();
  });

  it("revoke sets revoked_at and the key is still listable (never deleted, only marked)", async () => {
    const { key } = await createApiKey("ws_1", "member_1", { name: "A", scopes: ["crm.read"] });
    const revoked = revokeApiKey(key.id);
    expect(revoked?.revoked_at).not.toBeNull();
    expect(getApiKeyById(key.id)?.revoked_at).not.toBeNull();
  });

  it("revoke on an unknown id returns null", () => {
    expect(revokeApiKey("nonexistent")).toBeNull();
  });

  it("seedDemoApiKey is idempotent — calling it twice never creates a second demo key", async () => {
    await seedDemoApiKey("ws_1", "member_1");
    await seedDemoApiKey("ws_1", "member_1");
    const demoKeys = listApiKeysForWorkspace("ws_1").filter((k) => k.name === "Demo Integration");
    expect(demoKeys).toHaveLength(1);
  });

  it("the seeded demo key authenticates with the documented DEMO_API_KEY_SECRET", async () => {
    await seedDemoApiKey("ws_1", "member_1");
    const hash = await hashApiKeySecret(DEMO_API_KEY_SECRET);
    const key = getApiKeyByHash(hash);
    expect(key).not.toBeNull();
    expect(key?.scopes).toContain("crm.read");
    expect(key?.scopes).toContain("portal.read");
  });
});
