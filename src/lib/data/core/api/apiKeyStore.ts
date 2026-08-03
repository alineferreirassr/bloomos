import { generateId, nowIso } from "@/lib/data/utils";
import { generateApiKeySecret, hashApiKeySecret, displayPrefix } from "@/lib/api/apiKeyToken";
import { getGlobalMockStore } from "@/lib/data/core/globalMockStore";
import type { ApiKey, ApiKeyWithSecret, CreateApiKeyInput } from "@/types/apiKey";

/**
 * Checkpoint 16 — the Public API Key store. Mock-only, unconditionally,
 * regardless of `NEXT_PUBLIC_DATA_MODE` — the same "new checkpoint domain,
 * mock-only this phase" precedent every brand-new domain since Checkpoint
 * 13 has followed (see `clientPortalActivityStore.ts`'s own doc comment
 * for the full rationale). A real `api_keys` table + RLS policy is written
 * as a migration for a future checkpoint to actually apply.
 *
 * Backed by `getGlobalMockStore` (not a plain `let`) — see that module's
 * own doc comment: a Key created via the Developer Console (a Server
 * Action) must authenticate through `/api/v1/*` (a Route Handler), two
 * independently-compiled module graphs in Next.js's dev server.
 */
const store = getGlobalMockStore<ApiKey[]>("apiKeyStore.keys", () => []);

export function resetApiKeyStore(): void {
  store.set([]);
}

export async function createApiKey(workspaceId: string, createdBy: string, input: CreateApiKeyInput): Promise<ApiKeyWithSecret> {
  const secret = generateApiKeySecret();
  const key_hash = await hashApiKeySecret(secret);
  const now = nowIso();
  const key: ApiKey = {
    id: generateId("api-key"),
    workspace_id: workspaceId,
    name: input.name,
    key_prefix: displayPrefix(secret),
    key_hash,
    scopes: input.scopes,
    created_by: createdBy,
    created_at: now,
    last_used_at: null,
    revoked_at: null,
    rotated_at: null,
  };
  store.set([...store.get(), key]);
  return { key, secret };
}

export function listApiKeysForWorkspace(workspaceId: string): ApiKey[] {
  return store
    .get()
    .filter((key) => key.workspace_id === workspaceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getApiKeyById(id: string): ApiKey | null {
  return store.get().find((key) => key.id === id) ?? null;
}

export function getApiKeyByHash(key_hash: string): ApiKey | null {
  return store.get().find((key) => key.key_hash === key_hash) ?? null;
}

export function touchApiKeyLastUsed(id: string): void {
  store.set(store.get().map((key) => (key.id === id ? { ...key, last_used_at: nowIso() } : key)));
}

/** Replaces a key's own secret in place (same id, same name/scopes/history) — a rotated key's old secret stops authenticating immediately, but the record itself (and its `last_used_at` history) is never lost, distinct from revocation. */
export async function rotateApiKey(id: string): Promise<ApiKeyWithSecret | null> {
  const existing = getApiKeyById(id);
  if (!existing || existing.revoked_at !== null) return null;

  const secret = generateApiKeySecret();
  const key_hash = await hashApiKeySecret(secret);
  const rotated: ApiKey = { ...existing, key_hash, key_prefix: displayPrefix(secret), rotated_at: nowIso() };
  store.set(store.get().map((key) => (key.id === id ? rotated : key)));
  return { key: rotated, secret };
}

export function revokeApiKey(id: string): ApiKey | null {
  const existing = getApiKeyById(id);
  if (!existing) return null;
  const revoked: ApiKey = { ...existing, revoked_at: nowIso() };
  store.set(store.get().map((key) => (key.id === id ? revoked : key)));
  return revoked;
}

/**
 * A real, working demo key seeded so this checkpoint is genuinely
 * live-demoable without a member first creating one — the same "seed a
 * real demo, not an empty state" precedent Checkpoint 14's own message
 * thread seed established. The secret is a fixed, publicly-documented
 * value (`docs/public-api.md`) precisely *because* it's a demo credential,
 * never a real one — a live Workspace would never do this for a real key.
 */
export const DEMO_API_KEY_SECRET = "bloom_sk_demo_00000000000000000000000000000000";
const DEMO_API_KEY_ID = "api-key-demo";

/** Idempotent by checking the shared store itself (never a separate `let` flag) — a separate flag would face the exact same cross-module-graph duplication `getGlobalMockStore` exists to avoid. */
export async function seedDemoApiKey(workspaceId: string, createdBy: string): Promise<void> {
  if (store.get().some((key) => key.id === DEMO_API_KEY_ID)) return;
  const key_hash = await hashApiKeySecret(DEMO_API_KEY_SECRET);
  const now = nowIso();
  store.set([
    ...store.get(),
    {
      id: DEMO_API_KEY_ID,
      workspace_id: workspaceId,
      name: "Demo Integration",
      key_prefix: displayPrefix(DEMO_API_KEY_SECRET),
      key_hash,
      scopes: ["crm.read", "finance.read", "documents.read", "workflow.read", "analytics.read", "portal.read"],
      created_by: createdBy,
      created_at: now,
      last_used_at: null,
      revoked_at: null,
      rotated_at: null,
    },
  ]);
}
