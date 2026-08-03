/**
 * v2.0 Checkpoint 32 — Step 28 (Performance). "Avoid recalculating every
 * journey after one client record changes." `listClientJourneysAction`/
 * `getJourneyAnalyticsAction` evaluate every Lead and Client in the
 * workspace on every call — the one genuinely expensive read path this
 * checkpoint has. A short-TTL, workspace-scoped in-memory cache sits in
 * front of both; every mutation action in `clientJourneyActions.ts`
 * (transition/assign owner/create or update an information request)
 * calls `invalidateJourneyCache(workspaceId)` so a change is never
 * masked by a stale cached list. This is deliberately the one cache this
 * checkpoint adds — `evaluateClientJourneyAction` (a single subject) is
 * cheap enough on its own that caching it would only add staleness risk
 * for no real benefit.
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

export function invalidateJourneyCache(workspaceId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) cache.delete(key);
  }
}

export function resetJourneyCache(): void {
  cache.clear();
}
