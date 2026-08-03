import { generateId, nowIso } from "@/lib/data/utils";
import { computeBackoffDelayMs } from "@/core/integrations/retryEngine";
import { DEFAULT_RETRY_POLICY } from "@/core/integrations/types";
import type { QueueJob, QueueJobPriority, RetryPolicy } from "@/core/integrations/types";

/**
 * The Queue Engine (v2 Checkpoint 22, Step 8) — an in-process job queue,
 * the same explicit non-durability scope `deliverWithRetry` (Checkpoint
 * 17) already documented for its own retry loop: a plain in-memory array,
 * not a real background worker or durable broker (the spec's own
 * Non-Goal — "Real background workers"). It exists so a future
 * Synchronization Engine run, or any provider action that shouldn't block
 * the request that triggered it, has one shared place to enqueue work —
 * `claimNextJob` is what a (future, still-not-built) worker loop would
 * call in a `while (true)` poll; nothing in this checkpoint runs that
 * loop automatically.
 */

const PRIORITY_ORDER: Record<QueueJobPriority, number> = { high: 0, normal: 1, low: 2 };

let jobs: QueueJob[] = [];

export function resetQueueEngine(): void {
  jobs = [];
}

export interface EnqueueJobParams {
  workspaceId: string;
  queue: string;
  kind: string;
  payload: Record<string, unknown>;
  priority?: QueueJobPriority;
  maxAttempts?: number;
  /** Defers the job's own first eligibility — defaults to now (immediately claimable). */
  availableAt?: string;
}

export function enqueueJob(params: EnqueueJobParams): QueueJob {
  const now = nowIso();
  const job: QueueJob = {
    id: generateId("queue-job"),
    workspace_id: params.workspaceId,
    queue: params.queue,
    kind: params.kind,
    payload: params.payload,
    status: "queued",
    priority: params.priority ?? "normal",
    attempts: 0,
    max_attempts: params.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts,
    available_at: params.availableAt ?? now,
    created_at: now,
    updated_at: now,
    started_at: null,
    completed_at: null,
    last_error: null,
  };
  jobs = [...jobs, job];
  return job;
}

function updateJob(id: string, patch: Partial<QueueJob>): QueueJob | null {
  const existing = jobs.find((job) => job.id === id);
  if (!existing) return null;
  const updated: QueueJob = { ...existing, ...patch, updated_at: nowIso() };
  jobs = jobs.map((job) => (job.id === id ? updated : job));
  return updated;
}

/** Picks the highest-priority, oldest, currently-eligible `queued`/`delayed` job on the named queue and marks it `running` — the same "claim, don't peek" discipline a real worker needs to avoid two workers picking up the same job. */
export function claimNextJob(queue: string): QueueJob | null {
  const now = Date.now();
  const eligible = jobs
    .filter((job) => job.queue === queue && (job.status === "queued" || job.status === "delayed") && new Date(job.available_at).getTime() <= now)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at));
  const next = eligible[0];
  if (!next) return null;
  return updateJob(next.id, { status: "running", started_at: nowIso(), attempts: next.attempts + 1 });
}

export function completeJob(jobId: string): QueueJob | null {
  return updateJob(jobId, { status: "succeeded", completed_at: nowIso(), last_error: null });
}

/** Retries with the same shared exponential backoff every other retrying subsystem uses, or marks the job terminally `failed` once `max_attempts` is exhausted. */
export function failJob(jobId: string, error: string, policy: RetryPolicy = DEFAULT_RETRY_POLICY): QueueJob | null {
  const existing = jobs.find((job) => job.id === jobId);
  if (!existing) return null;
  if (existing.attempts < existing.max_attempts) {
    const delayMs = computeBackoffDelayMs(existing.attempts, policy);
    return updateJob(jobId, { status: "delayed", available_at: new Date(Date.now() + delayMs).toISOString(), last_error: error });
  }
  return updateJob(jobId, { status: "failed", completed_at: nowIso(), last_error: error });
}

export function cancelJob(jobId: string): QueueJob | null {
  return updateJob(jobId, { status: "cancelled", completed_at: nowIso() });
}

export function getJob(jobId: string): QueueJob | null {
  return jobs.find((job) => job.id === jobId) ?? null;
}

export function listJobsForQueue(workspaceId: string, queue: string): QueueJob[] {
  return jobs.filter((job) => job.workspace_id === workspaceId && job.queue === queue).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function listJobsForWorkspace(workspaceId: string): QueueJob[] {
  return jobs.filter((job) => job.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
