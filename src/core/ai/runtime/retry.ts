/**
 * Bounded exponential backoff — `baseMs * 2^attempt`, capped at `maxMs` so a
 * long retry chain can never balloon into a multi-minute wait (the "prevent
 * retry storms" requirement). Deliberately no random jitter: this project's
 * tests must run deterministically, and jitter would make the exact delay
 * unassertable without a fake-timer dependency this checkpoint doesn't need.
 */
export function computeBackoffDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}
