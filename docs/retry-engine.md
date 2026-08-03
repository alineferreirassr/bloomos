# Retry Engine

v2 Checkpoint 22, Step 10 (`core/integrations/retryEngine.ts`) — the one shared exponential-backoff primitive this checkpoint's own research found duplicated (and, in Automation's case, missing entirely) across the codebase.

## What research found

- `core/webhooks/retryEngine.ts` (Checkpoint 17) already had a real, tested exponential-backoff formula — 1s base, doubling, capped at 60s, 5 attempts — hardcoded into its own `computeBackoffDelayMs`.
- `core/automation/actionRunner.ts` (Checkpoint 9) retried immediately with **zero delay** between attempts — a gap its own prior doc comment had already flagged: *"Step 15's own 'retry policies' (backoff, per-workflow-step retry) are reserved for a future [checkpoint]."* This checkpoint is that future checkpoint.

## The shared primitive

```ts
computeBackoffDelayMs(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number
```

`base = min(policy.baseDelayMs * 2^(attempt-1), policy.maxDelayMs)`, optionally with up to ±20% random jitter when `policy.jitter` is `true` (off by default, so Webhooks' own exact, deterministic, already-tested sequence is preserved byte-for-byte).

```ts
executeWithRetry<T>(fn: () => Promise<T>, policy?: RetryPolicy): Promise<{ succeeded, result, attempts: RetryAttemptRecord[], error }>
```

Runs `fn` up to `policy.maxAttempts` times with a real `delay()`-based wait between failures, and returns a full attempt history rather than throwing — so a caller (Automation, the Queue Engine, a future Sync Engine run) can inspect exactly what happened without its own try/catch.

`DEFAULT_RETRY_POLICY = { baseDelayMs: 1000, maxDelayMs: 60_000, maxAttempts: 5, jitter: false }` — Webhooks' own exact historical constants.

## Retrofits

### `core/webhooks/retryEngine.ts`

```ts
export function computeBackoffDelayMs(attempt: number): number {
  return computeSharedBackoffDelayMs(attempt, { baseDelayMs: BASE_BACKOFF_MS, maxDelayMs: MAX_BACKOFF_MS, maxAttempts: MAX_DELIVERY_ATTEMPTS, jitter: false });
}
```

A pure delegation — every constant unchanged, so Webhooks' own existing test suite passes without modification. Confirmed with an exact-match test in `retryEngine.test.ts`: `[1, 2, 3, 4, 5].map(computeBackoffDelayMs) === [1000, 2000, 4000, 8000, 16000]`.

### `core/automation/actionRunner.ts`

`runAutomationAction()`'s retry loop now waits `computeBackoffDelayMs(attempts, DEFAULT_RETRY_POLICY)` between attempts instead of retrying immediately, closing the exact gap the function's own prior doc comment flagged. `delay()` (`lib/data/utils.ts`) is a no-op in the test environment (`NODE_ENV === "test"`), so this file's own existing retry-strategy tests run exactly as fast as before — confirmed by rerunning the existing suite (21/21 passing) before building anything else this checkpoint.

## Every subsystem sharing this primitive today

| Subsystem | Policy |
|---|---|
| Webhooks (`deliverWithRetry`) | 1s base, 60s cap, 5 attempts, no jitter |
| Automation (`runAutomationAction`) | `DEFAULT_RETRY_POLICY` |
| Queue Engine (`failJob`) | caller-supplied, defaults to `DEFAULT_RETRY_POLICY` |


## v2 Checkpoint 43 additions

No change to the shared backoff primitive itself. The new Twilio/DocuSign webhook routes create Queue Engine jobs with `maxAttempts: 1` (matching Stripe's own inbound-webhook jobs) — retry policy for inbound webhook processing is intentionally the provider's own retry (Twilio/DocuSign both re-deliver a failed webhook on their own schedule), not this engine's.
