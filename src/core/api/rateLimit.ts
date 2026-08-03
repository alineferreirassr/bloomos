/**
 * Checkpoint 16, Step 1's own "Rate-limit hooks (placeholder)." A real
 * seam, not a TODO comment: `createApiHandler` (`handler.ts`) already
 * calls this on every request and already reacts correctly to a
 * `{allowed: false}` result (a real `rate_limited` 429 response, and a
 * real `"API rate limit exceeded"` observability log — see
 * `observability.ts`). What's genuinely deferred is the *policy* — no
 * request counter, no sliding window, no per-key limit configuration
 * exists yet, so this always returns `{allowed: true}` today. A future
 * checkpoint wiring a real limiter (in-memory for mock mode, a Postgres
 * function or an edge KV store for Supabase mode) only has to change this
 * one function's own body — every call site, response shape, and log
 * line is already correct and needs no change. Mirrors the same
 * "structurally real, policy deferred" shape Checkpoint 15's own
 * `MetricRefreshPolicy` ("future caching") already established.
 */
export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(_apiKeyId: string): Promise<RateLimitDecision> {
  return { allowed: true };
}
