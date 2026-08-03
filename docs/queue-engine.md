# Queue Engine

v2 Checkpoint 22, Step 8 (`core/integrations/queueEngine.ts`) — an in-process job queue. The same explicit non-durability scope `deliverWithRetry` (Checkpoint 17) already documented for its own retry loop: a plain in-memory array, not a real background worker or durable broker — the checkpoint's own Non-Goal, "Real background workers," is honored precisely.

## Why it exists

It gives a future Synchronization Engine run, or any provider action that shouldn't block the request that triggered it, one shared place to enqueue work. `claimNextJob()` is what a (still not built) worker loop would call in a `while (true)` poll; nothing in this checkpoint runs that loop automatically — no `setInterval`, no cron, no background process starts on its own.

## Job lifecycle

```
enqueueJob()  →  queued (or delayed, if availableAt is in the future)
                    │
              claimNextJob(queue)  — picks highest-priority, oldest, currently-eligible job
                    │
                 running
                 ╱      ╲
         completeJob()   failJob(error)
              │              │
          succeeded    attempts < max_attempts?
                          ╱            ╲
                       yes              no
                        │                │
                    delayed          failed
                 (real backoff,     (terminal)
                  claimable again
                  once available_at
                  elapses)
```

`claimNextJob` sorts eligible jobs by priority (`high` → `normal` → `low`), then oldest-first — the same "claim, don't peek" discipline a real worker needs to avoid two workers picking up the same job (it atomically marks the job `running` and increments `attempts` in the same call).

## Retry delegation

`failJob()` uses the shared Retry Engine's `computeBackoffDelayMs()` (see `docs/retry-engine.md`) to compute the next `available_at` — the same exponential-backoff formula every other retrying subsystem in this codebase now shares.

## API

```ts
enqueueJob(params: { workspaceId, queue, kind, payload, priority?, maxAttempts?, availableAt? }): QueueJob
claimNextJob(queue: string): QueueJob | null
completeJob(jobId: string): QueueJob | null
failJob(jobId: string, error: string, policy?: RetryPolicy): QueueJob | null
cancelJob(jobId: string): QueueJob | null
getJob(jobId: string): QueueJob | null
listJobsForQueue(workspaceId: string, queue: string): QueueJob[]
listJobsForWorkspace(workspaceId: string): QueueJob[]
resetQueueEngine(): void // test-only
```

## Known limitation

No automatic worker loop exists — jobs enqueued today stay `queued` until something explicitly calls `claimNextJob()`. The Developer Center's Diagnostics tab reads the queue (see `docs/integration-platform.md`), but nothing in this checkpoint drains it automatically; that's a future checkpoint's own scope.


## v2 Checkpoint 43 additions

Two new queue names are in active use: `twilio-webhooks` and `docusign-webhooks`, one job per inbound webhook request, created by the routes documented in `docs/webhook-engine.md`. No new queue *mechanics* were added — `enqueueJob`/`claimNextJob`/`completeJob`/`failJob` are unchanged; this is only new call sites, the same non-durable, no-automatic-worker-loop scope this doc already discloses.
