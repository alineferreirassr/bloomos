import type { RetryPolicy } from "@/core/integrations/types";

/**
 * SOCIAL-04B — the initial BloomOS Social scheduling policy, in one small,
 * reviewable place (mirrors `core/webhooks/retryEngine.ts`'s own
 * `MAX_DELIVERY_ATTEMPTS` colocation). This is a founder product decision,
 * not an architectural derivation — see SOCIAL-04B's own checkpoint report.
 *
 * MUST stay in sync with `claim_due_social_posts()`'s own hardcoded `< 3`
 * attempt-limit check in `supabase/migrations/20260916100000_social_posts_scheduling.sql`
 * — the database is the actual enforcement point (a service-role caller
 * bypasses application code entirely), this constant is what the
 * TypeScript-side retry/backoff decision (`computeNextAttempt`) reasons
 * about to stay consistent with it.
 */
export const MAX_PUBLISH_ATTEMPTS = 3;

/** The exact shared backoff primitive every other retrying subsystem in this codebase uses (`core/integrations/retryEngine.ts`) — no new formula. */
export const SOCIAL_RETRY_POLICY: RetryPolicy = {
  maxAttempts: MAX_PUBLISH_ATTEMPTS,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: false,
};

const DEFAULT_CLAIM_LEASE_SECONDS = 600;
const LEASE_ENV_VAR = "SOCIAL_SCHEDULER_LEASE_SECONDS";

/**
 * SOCIAL-04A's own architecture audit found this project's actual Vercel
 * function execution-duration limit is not mechanically verifiable from
 * repository evidence (no `maxDuration`/`runtime` export exists anywhere in
 * `src/app`, no `vercel.json` existed before this checkpoint) — per that
 * audit's own instruction, this stays a server-side, env-overridable
 * configuration constant with a safe default, rather than a guessed
 * hardcoded number presented as architecturally derived. 600s (10 minutes)
 * is comfortably longer than any plausible single scheduler invocation
 * (a bounded batch of Social posts, each a handful of Meta HTTP calls) on
 * any Vercel plan this project could realistically be on, while still
 * reclaiming a genuinely crashed worker's claim in a reasonable window.
 * Read fresh on every call (never cached at module scope), matching
 * `lib/env.ts`'s own "re-read on every access, never throw" discipline —
 * an invalid or missing env value silently falls back to the default,
 * never crashes the scheduler route.
 */
export function getClaimLeaseMs(): number {
  const raw = process.env[LEASE_ENV_VAR]?.trim();
  if (!raw) return DEFAULT_CLAIM_LEASE_SECONDS * 1000;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CLAIM_LEASE_SECONDS * 1000;
  return parsed * 1000;
}

/** The exact existing generic message `publishSocialPostNowAction` already uses for any Meta connection/credential/scope problem — shared here so the background executor reports the identical, safe, non-revealing message rather than a second, divergent string. */
export const RECONNECT_ERROR = "Reconnect Meta to enable publishing.";
