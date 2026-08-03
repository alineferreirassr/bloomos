import { describe, expect, it } from "vitest";
import { buildFallbackChain, resolveActiveResource, needsEscalation, isFallbackInUse } from "@/core/allocation/fallbackEngine";

describe("buildFallbackChain", () => {
  it("assigns sequential tiers to backups in order", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, [
      { resource_type: "worker", resource_id: "worker_2" },
      { resource_type: "worker", resource_id: "worker_3" },
    ]);
    expect(chain.backups).toEqual([
      { resource_type: "worker", resource_id: "worker_2", tier: 1 },
      { resource_type: "worker", resource_id: "worker_3", tier: 2 },
    ]);
  });

  it("caps backups at maxBackups", () => {
    const chain = buildFallbackChain(
      0,
      { resource_type: "worker", resource_id: "worker_1" },
      [
        { resource_type: "worker", resource_id: "worker_2" },
        { resource_type: "worker", resource_id: "worker_3" },
        { resource_type: "worker", resource_id: "worker_4" },
      ],
      1,
    );
    expect(chain.backups).toHaveLength(1);
  });
});

describe("resolveActiveResource", () => {
  it("returns the primary when it's available", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, [{ resource_type: "worker", resource_id: "worker_2" }]);
    const result = resolveActiveResource(chain, new Set());
    expect(result).toEqual({ resource_type: "worker", resource_id: "worker_1", tier: null });
  });

  it("falls through to the first available backup when the primary is unavailable", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, [
      { resource_type: "worker", resource_id: "worker_2" },
      { resource_type: "worker", resource_id: "worker_3" },
    ]);
    const result = resolveActiveResource(chain, new Set(["worker_1"]));
    expect(result).toEqual({ resource_type: "worker", resource_id: "worker_2", tier: 1 });
  });

  it("skips an unavailable backup to reach the next tier", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, [
      { resource_type: "worker", resource_id: "worker_2" },
      { resource_type: "worker", resource_id: "worker_3" },
    ]);
    const result = resolveActiveResource(chain, new Set(["worker_1", "worker_2"]));
    expect(result).toEqual({ resource_type: "worker", resource_id: "worker_3", tier: 2 });
  });

  it("returns null when the primary and every backup are unavailable", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, [{ resource_type: "worker", resource_id: "worker_2" }]);
    const result = resolveActiveResource(chain, new Set(["worker_1", "worker_2"]));
    expect(result).toBeNull();
  });

  it("returns null when there is no primary and no backups resolve", () => {
    const chain = buildFallbackChain(0, null, []);
    expect(resolveActiveResource(chain, new Set())).toBeNull();
  });
});

describe("needsEscalation / isFallbackInUse", () => {
  it("needsEscalation is true exactly when resolveActiveResource returns null", () => {
    const chain = buildFallbackChain(0, { resource_type: "worker", resource_id: "worker_1" }, []);
    expect(needsEscalation(chain, new Set(["worker_1"]))).toBe(true);
    expect(needsEscalation(chain, new Set())).toBe(false);
  });

  it("isFallbackInUse is false for the primary and true for any backup", () => {
    expect(isFallbackInUse({ resource_type: "worker", resource_id: "worker_1", tier: null })).toBe(false);
    expect(isFallbackInUse({ resource_type: "worker", resource_id: "worker_2", tier: 1 })).toBe(true);
    expect(isFallbackInUse(null)).toBe(false);
  });
});
