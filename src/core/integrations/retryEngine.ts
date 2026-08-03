import { delay } from "@/lib/data/utils";
import type { RetryAttemptRecord, RetryPolicy } from "@/core/integrations/types";
import { DEFAULT_RETRY_POLICY } from "@/core/integrations/types";

/**
 * The Retry Engine (v2 Checkpoint 22, Step 10) — the one shared backoff
 * primitive this checkpoint's own research found duplicated (and, in
 * Automation's case, missing entirely) across the codebase:
 * `core/webhooks/retryEngine.ts`'s own `computeBackoffDelayMs` used a
 * hardcoded 1s-base/60s-cap exponential formula; `core/automation/
 * actionRunner.ts` retried immediately with no delay at all, a gap its
 * own doc comment already flagged as "Step 15's own 'retry policies'
 * ... reserved for a future [checkpoint]." This is that future
 * checkpoint. `computeBackoffDelayMs` here is the exact same formula
 * Webhooks already used (so Webhooks' own retry sequence and its
 * existing test suite are byte-for-byte unchanged when retrofitted to
 * call this instead of its own copy) — see `core/webhooks/retryEngine.ts`,
 * now a thin wrapper around this file.
 */

export function computeBackoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  const base = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs);
  if (!policy.jitter) return base;
  const jitterRange = base * 0.2;
  const offset = Math.random() * jitterRange * 2 - jitterRange;
  return Math.max(0, Math.round(base + offset));
}

export interface ExecuteWithRetryResult<T> {
  succeeded: boolean;
  result: T | null;
  attempts: RetryAttemptRecord[];
  error: string | null;
}

/**
 * Runs `fn` up to `policy.maxAttempts` times with exponential backoff
 * between attempts, entirely in-process (a real `setTimeout`-backed
 * delay, same "not a durable job queue" scope `deliverWithRetry` already
 * documented — an in-flight backoff is lost on process restart). Returns
 * a full attempt history rather than throwing, so a caller (Automation,
 * a future Sync Engine run) can inspect exactly what happened without
 * wrapping this in its own try/catch.
 */
export async function executeWithRetry<T>(fn: () => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY_POLICY): Promise<ExecuteWithRetryResult<T>> {
  const attempts: RetryAttemptRecord[] = [];

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const result = await fn();
      attempts.push({ attempt, occurred_at: new Date().toISOString(), succeeded: true, delayMs: null, error: null });
      return { succeeded: true, result, attempts, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isLastAttempt = attempt === policy.maxAttempts;
      const delayMs = isLastAttempt ? null : computeBackoffDelayMs(attempt, policy);
      attempts.push({ attempt, occurred_at: new Date().toISOString(), succeeded: false, delayMs, error: message });
      if (!isLastAttempt && delayMs !== null) {
        await delay(delayMs);
      } else {
        return { succeeded: false, result: null, attempts, error: message };
      }
    }
  }

  return { succeeded: false, result: null, attempts, error: "Retry loop exited unexpectedly." };
}
