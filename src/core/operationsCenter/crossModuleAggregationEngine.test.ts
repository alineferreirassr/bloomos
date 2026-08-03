import { beforeEach, describe, expect, it } from "vitest";
import { aggregateFromSources, computeSnapshotConfidence, getSourceData, resetAggregationCache, type SourceFetcher } from "@/core/operationsCenter/crossModuleAggregationEngine";
import type { SourceOutcome } from "@/types/operationsCenter";

function successFetcher<T>(source: SourceFetcher<T>["source"], data: T): SourceFetcher<T> {
  return { source, fetch: async () => ({ success: true, data }) };
}

function failedFetcher(source: SourceFetcher<never>["source"], error: string): SourceFetcher<never> {
  return { source, fetch: async () => ({ success: false, error }) };
}

function throwingFetcher(source: SourceFetcher<never>["source"], message: string): SourceFetcher<never> {
  return { source, fetch: async () => { throw new Error(message); } };
}

beforeEach(() => {
  resetAggregationCache();
});

describe("aggregateFromSources", () => {
  it("marks a source successful when its fetch resolves with data", async () => {
    const result = await aggregateFromSources("ws_1", [successFetcher("dispatch", { orders: 3 })]);
    expect(result.outcomes[0].state).toBe("successful");
    expect(result.outcomes[0].data).toEqual({ orders: 3 });
    expect(result.outcomes[0].fetchedAt).not.toBeNull();
  });

  it("marks a source failed when its fetch resolves with an anticipated error and nothing is cached", async () => {
    const result = await aggregateFromSources("ws_1", [failedFetcher("scheduling", "Access denied.")]);
    expect(result.outcomes[0].state).toBe("failed");
    expect(result.outcomes[0].data).toBeNull();
    expect(result.outcomes[0].error).toBe("Access denied.");
  });

  it("marks a source unavailable when its fetch throws and nothing is cached", async () => {
    const result = await aggregateFromSources("ws_1", [throwingFetcher("allocation", "Unexpected crash")]);
    expect(result.outcomes[0].state).toBe("unavailable");
    expect(result.outcomes[0].data).toBeNull();
  });

  it("falls back to a cached value, flagged stale, when a later fetch fails", async () => {
    await aggregateFromSources("ws_1", [successFetcher("dispatch", { orders: 5 })]);
    const result = await aggregateFromSources("ws_1", [failedFetcher("dispatch", "Temporarily unavailable.")]);
    expect(result.outcomes[0].state).toBe("stale");
    expect(result.outcomes[0].data).toEqual({ orders: 5 });
  });

  it("falls back to a cached value, flagged stale, when a later fetch throws", async () => {
    await aggregateFromSources("ws_1", [successFetcher("route_optimization", { plans: 2 })]);
    const result = await aggregateFromSources("ws_1", [throwingFetcher("route_optimization", "boom")]);
    expect(result.outcomes[0].state).toBe("stale");
    expect(result.outcomes[0].data).toEqual({ plans: 2 });
  });

  it("one failing source does not affect another successful source in the same aggregation", async () => {
    const result = await aggregateFromSources("ws_1", [successFetcher("dispatch", { orders: 1 }), throwingFetcher("scheduling", "down")]);
    expect(result.outcomes.find((o) => o.source === "dispatch")?.state).toBe("successful");
    expect(result.outcomes.find((o) => o.source === "scheduling")?.state).toBe("unavailable");
  });

  it("caches are scoped per workspace", async () => {
    await aggregateFromSources("ws_1", [successFetcher("dispatch", { orders: 9 })]);
    const result = await aggregateFromSources("ws_2", [failedFetcher("dispatch", "no data")]);
    expect(result.outcomes[0].state).toBe("failed");
  });
});

describe("computeSnapshotConfidence", () => {
  it("is vacuous-100 with no sources at all", () => {
    expect(computeSnapshotConfidence([])).toBe(100);
  });

  it("is 100 when every source is successful", () => {
    const outcomes: SourceOutcome<unknown>[] = [
      { source: "dispatch", state: "successful", data: {}, error: null, fetchedAt: "now" },
      { source: "scheduling", state: "successful", data: {}, error: null, fetchedAt: "now" },
    ];
    expect(computeSnapshotConfidence(outcomes)).toBe(100);
  });

  it("weighs stale sources at half and failed/unavailable at zero", () => {
    const outcomes: SourceOutcome<unknown>[] = [
      { source: "dispatch", state: "successful", data: {}, error: null, fetchedAt: "now" },
      { source: "scheduling", state: "stale", data: {}, error: "e", fetchedAt: "before" },
      { source: "allocation", state: "failed", data: null, error: "e", fetchedAt: null },
      { source: "workforce", state: "unavailable", data: null, error: "e", fetchedAt: null },
    ];
    // (1 + 0.5 + 0 + 0) / 4 = 0.375 -> 38%
    expect(computeSnapshotConfidence(outcomes)).toBe(38);
  });
});

describe("getSourceData", () => {
  it("returns the source's own data when present", () => {
    const outcomes: SourceOutcome<unknown>[] = [{ source: "dispatch", state: "successful", data: { orders: 4 }, error: null, fetchedAt: "now" }];
    expect(getSourceData<{ orders: number }>(outcomes, "dispatch")).toEqual({ orders: 4 });
  });

  it("returns null when the source is absent or has no data", () => {
    expect(getSourceData([], "dispatch")).toBeNull();
    const outcomes: SourceOutcome<unknown>[] = [{ source: "dispatch", state: "failed", data: null, error: "e", fetchedAt: null }];
    expect(getSourceData(outcomes, "dispatch")).toBeNull();
  });
});
