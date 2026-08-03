import { describe, expect, it } from "vitest";
import { computeDistanceToRequirement, isWithinMaximumDistance } from "@/core/capability/locationCompatibilityEngine";
import type { LocationSnapshot } from "@/types/workforce";
import type { CapabilityLocationRequirement } from "@/types/capability";

function makeSnapshot(overrides: Partial<LocationSnapshot> = {}): LocationSnapshot {
  return { worker_id: "worker_1", workspace_id: "ws_1", latitude: 40.7128, longitude: -74.006, accuracy_meters: 10, recorded_at: "2026-07-30T00:00:00.000Z", source: "mobile_app", ...overrides };
}

const NYC: CapabilityLocationRequirement = { latitude: 40.7128, longitude: -74.006, label: "New York City" };
const LA: CapabilityLocationRequirement = { latitude: 34.0522, longitude: -118.2437, label: "Los Angeles" };

describe("computeDistanceToRequirement", () => {
  it("returns unknown, never a zero fabrication, when the worker has no location", () => {
    const result = computeDistanceToRequirement(null, NYC);
    expect(result.kind).toBe("unknown");
    expect(result.distanceKm).toBeNull();
    expect(result.reason).not.toBeNull();
  });

  it("returns unknown when there is no location requirement to measure against", () => {
    expect(computeDistanceToRequirement(makeSnapshot(), null).kind).toBe("unknown");
  });

  it("returns ~0km for two identical coordinates", () => {
    const result = computeDistanceToRequirement(makeSnapshot(), NYC);
    expect(result.kind).toBe("known");
    expect(result.distanceKm).toBeCloseTo(0, 1);
  });

  it("computes a real, deterministic distance between two distinct coordinates (NYC to LA is ~3936km)", () => {
    const result = computeDistanceToRequirement(makeSnapshot(), LA);
    expect(result.kind).toBe("known");
    expect(result.distanceKm).toBeGreaterThan(3900);
    expect(result.distanceKm).toBeLessThan(4000);
  });

  it("is deterministic — same inputs produce the same output every time", () => {
    const a = computeDistanceToRequirement(makeSnapshot(), LA);
    const b = computeDistanceToRequirement(makeSnapshot(), LA);
    expect(a.distanceKm).toBe(b.distanceKm);
  });
});

describe("isWithinMaximumDistance", () => {
  it("is always compatible when no maximum is configured", () => {
    expect(isWithinMaximumDistance({ kind: "known", distanceKm: 5000, reason: null }, null)).toBe(true);
  });

  it("returns null (never true or false) for an unknown distance", () => {
    expect(isWithinMaximumDistance({ kind: "unknown", distanceKm: null, reason: "x" }, 100)).toBeNull();
  });

  it("compares a known distance against the configured maximum", () => {
    expect(isWithinMaximumDistance({ kind: "known", distanceKm: 50, reason: null }, 100)).toBe(true);
    expect(isWithinMaximumDistance({ kind: "known", distanceKm: 150, reason: null }, 100)).toBe(false);
  });
});
