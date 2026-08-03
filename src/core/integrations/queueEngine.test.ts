import { beforeEach, describe, expect, it } from "vitest";
import { cancelJob, claimNextJob, completeJob, enqueueJob, failJob, getJob, listJobsForQueue, resetQueueEngine } from "@/core/integrations/queueEngine";

beforeEach(() => {
  resetQueueEngine();
});

describe("enqueueJob / claimNextJob", () => {
  it("claims jobs in priority order, then oldest-first", () => {
    enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, priority: "low" });
    enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, priority: "normal" });
    const high = enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, priority: "high" });

    const claimed = claimNextJob("sync");
    expect(claimed?.id).toBe(high.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempts).toBe(1);
  });

  it("never claims a job whose available_at is in the future", () => {
    enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, availableAt: new Date(Date.now() + 60_000).toISOString() });
    expect(claimNextJob("sync")).toBeNull();
  });

  it("scopes claiming to the named queue", () => {
    enqueueJob({ workspaceId: "ws_1", queue: "other-queue", kind: "test", payload: {} });
    expect(claimNextJob("sync")).toBeNull();
  });
});

describe("completeJob / failJob", () => {
  it("marks a claimed job succeeded", () => {
    const job = enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {} });
    claimNextJob("sync");
    const completed = completeJob(job.id);
    expect(completed?.status).toBe("succeeded");
    expect(completed?.completed_at).not.toBeNull();
  });

  it("delays a job with backoff when attempts remain", () => {
    const job = enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, maxAttempts: 2 });
    claimNextJob("sync");
    const delayed = failJob(job.id, "first failure");
    expect(delayed?.status).toBe("delayed");
    expect(new Date(delayed!.available_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("marks a job terminally failed once max_attempts is exhausted", () => {
    const job = enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {}, maxAttempts: 1 });
    claimNextJob("sync");
    const failed = failJob(job.id, "only failure");
    expect(failed?.status).toBe("failed");
    expect(failed?.last_error).toBe("only failure");
    expect(getJob(job.id)?.completed_at).not.toBeNull();
  });
});

describe("cancelJob / listJobsForQueue", () => {
  it("cancels a job and lists jobs scoped to workspace + queue", () => {
    const job = enqueueJob({ workspaceId: "ws_1", queue: "sync", kind: "test", payload: {} });
    enqueueJob({ workspaceId: "ws_2", queue: "sync", kind: "test", payload: {} });
    const cancelled = cancelJob(job.id);
    expect(cancelled?.status).toBe("cancelled");
    expect(listJobsForQueue("ws_1", "sync")).toHaveLength(1);
  });
});
