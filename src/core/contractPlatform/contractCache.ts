/**
 * v2.0 Checkpoint 34 — Performance. Mirrors `proposalCache.ts`'s own 30s
 * TTL, workspace-scoped cache exactly (Checkpoint 33) — `listContractSummariesAction`/
 * `getContractAnalyticsAction` evaluate every contract in the workspace on
 * every call, the one genuinely expensive read path here. Every mutation
 * action in `contractPlatformActions.ts` calls `invalidateContractCache(workspaceId)`.
 */

const TTL_MS = 30_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidateContractCache(workspaceId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) cache.delete(key);
  }
}

export function resetContractCache(): void {
  cache.clear();
}
